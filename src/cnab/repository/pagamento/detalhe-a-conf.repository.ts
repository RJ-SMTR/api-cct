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
import { ClienteFavorecido } from '../../entity/cliente-favorecido.entity';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheAConf } from 'src/cnab/entity/conference/detalhe-a-conf.entity';

@Injectable()
export class DetalheAConfRepository {
  private logger: Logger = new Logger('DetalheAConfRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheAConf)
    private DetalheAConfRepository: Repository<DetalheAConf>,
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(
    dtos: DeepPartial<DetalheAConf>[],
  ): Promise<DetalheAConf[]> {
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
    const existingMap: Record<string, DeepPartial<DetalheAConf>> = existing.reduce(
      (m, i) => ({ ...m, [DetalheAConf.getUniqueId(i)]: i }),
      {},
    );
    // Check
    if (existing.length === dtos.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} DetalheAConf já existem, nada a fazer...`,
      );
    } else if (existing.length) {
      logWarn(
        this.logger,
        `${existing.length}/${dtos.length} DetalheAConf já existem, ignorando...`,
      );
      return [];
    }
    // Save new
    const newDTOs = dtos.reduce(
      (l, i) => [...l, ...(!existingMap[DetalheAConf.getUniqueId(i)] ? [i] : [])],
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

  public insert(dtos: DeepPartial<DetalheAConf>[]): Promise<InsertResult> {
    return this.DetalheAConfRepository.insert(dtos);
  }

  public async save(dto: DeepPartial<DetalheA>): Promise<DetalheA> {
    const saved = await this.DetalheAConfRepository.save(dto);
    return await this.DetalheAConfRepository.findOneOrFail({
      where: { id: saved.id },
    });
  }

  public async getOne(fields: EntityCondition<DetalheAConf>): Promise<DetalheA> {
    const one = await this.DetalheAConfRepository.findOneOrFail({
      where: fields,
    });
    if (one) {
      await this.forceManyEager([one]);
    }
    return one;
  }

  public async findOne(
    options: FindOneOptions<DetalheAConf>,
  ): Promise<Nullable<DetalheAConf>> {
    const one = await this.DetalheAConfRepository.findOne(options);
    if (one) {
      await this.forceManyEager([one]);
    }
    return one;
  }

  public async findMany(
    options?: FindManyOptions<DetalheAConf>,
  ): Promise<DetalheA[]> {
    const detalheA = await this.DetalheAConfRepository.find(options);
    await this.forceManyEager(detalheA);
    return detalheA;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o DetalheA.
   *
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return (
      (await this.DetalheAConfRepository.count({
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
  private async forceManyEager(detalhesA: DetalheAConf[]) {
    const favorecidoIds = detalhesA.reduce(
      (l, i) => [...l, i.clienteFavorecido.id],
      [],
    );
    if (favorecidoIds.length === 0) {
      return;
    }
    const favorecidos: ClienteFavorecido[] =
      await this.DetalheAConfRepository.query(
        `SELECT * from cliente_favorecido c WHERE c.id IN (${favorecidoIds.join(
          ',',
        )})`,
      );
    const favorecidosMap: Record<number, ClienteFavorecido> =
      favorecidos.reduce((m, i) => ({ ...m, [i.id]: i }), {});
    for (const one of detalhesA) {
      one.clienteFavorecido = favorecidosMap[one.clienteFavorecido.id];
    }
  }
}
