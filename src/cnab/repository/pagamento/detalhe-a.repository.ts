import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { logWarn } from 'src/utils/log-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  In,
  InsertResult,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<DetalheA>[],
  ): Promise<DetalheA[]> {
    // Existing
    const existing = await this.findMany({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            headerLote: { id: asNumber(i.headerLote?.id) },
            nsr: asNumber(i.nsr),
          },
        ],
        [],
      ),
    });
    const existingMap: Record<string, DeepPartial<DetalheA>> = existing.reduce(
      (m, i) => ({ ...m, [DetalheA.getUniqueId(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} DetalhesA já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} DetalhesA já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [...l, ...(!existingMap[DetalheA.getUniqueId(i)] ? [i] : [])],
      [],
    );
    const insert = await this.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const saved = await this.findMany({ where: { id: In(insertIds) } });
    return saved;
  }

  public insert(dtos: DeepPartial<DetalheA>[]): Promise<InsertResult> {
    return this.detalheARepository.insert(dtos);
  }

  public async save(dto: DeepPartial<DetalheA>): Promise<DetalheA> {
    const saved = await this.detalheARepository.save(dto);
    return await this.detalheARepository.findOneOrFail({
      where: { id: saved.id },
    });
  }

  public async getOne(fields: EntityCondition<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.findOneOrFail({
      where: fields,
    });
  }

  public async findOne(
    options: FindOneOptions<DetalheA>,
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(options);
  }

  public async findMany(
    options?: FindManyOptions<DetalheA>,
  ): Promise<DetalheA[]> {
    const detalheA = await this.detalheARepository.find(options);
   // await this.forceManyEager(detalheA);
    return detalheA;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o DetalheA.
   *
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return (
      (await this.detalheARepository.count({
        where: [
          { createdAt: MoreThanOrEqual(startOfDay(date)) },
          { createdAt: LessThanOrEqual(endOfDay(date)) },
        ],
      })) + 1
    );
  }

  /**
   * For some reason the default eager of ClienteFavorecido doesnt get columns like cpfCnpj.
   *
   * So we query separately the Entity and use it.
   */
  // private async forceManyEager(detalhesA: DetalheA[]) {
  //   const favorecidoIds = detalhesA.reduce(
  //     (l, i) => [...l, i.clienteFavorecido.id],
  //     [],
  //   );
  //   if (favorecidoIds.length === 0) {
  //     return;
  //   }
  //   const favorecidos: ClienteFavorecido[] =
  //     await this.detalheARepository.query(
  //       `SELECT * from cliente_favorecido c WHERE c.id IN (${favorecidoIds.join(
  //         ',',
  //       )})`,
  //     );
  //   const favorecidosMap: Record<number, ClienteFavorecido> =
  //     favorecidos.reduce((m, i) => ({ ...m, [i.id]: i }), {});
  //   for (const one of detalhesA) {
  //     one.clienteFavorecido = favorecidosMap[one.clienteFavorecido.id];
  //   }
  // }
}
