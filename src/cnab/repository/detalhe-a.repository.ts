import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { DetalheA } from '../entity/detalhe-a.entity';

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) { }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<Nullable<DetalheA>> {
    const one = await this.detalheARepository.findOne({
      where: fields,
    });
    if (one) {
      await this.forceEager(one)
    }
    return one;
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    const many = await this.detalheARepository.find({
      where: fields,
      loadEagerRelations: true,
    });
    for (const one of many) {
      await this.forceEager(one)
    }
    return many;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o DetalheA.
   * 
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheARepository.count({
      where: [
        { createdAt: MoreThanOrEqual(startOfDay(date)) },
        { createdAt: LessThanOrEqual(endOfDay(date)) },
      ]
    }) + 1;
  }

  /**
   * For some reason the default eager of ClienteFavorecido doesnt get columns like cpfCnpj.
   * 
   * So we query separately the Entity and use it.
   */
  private async forceEager(one: DetalheA) {
    if (one.clienteFavorecido) {
      const favorecidos: ClienteFavorecido[] = await this.detalheARepository
        .query('SELECT * from cliente_favorecido c WHERE c.id = $1', [one.clienteFavorecido.id]);
      const favorecido = favorecidos.pop();
      if (!favorecido) {
        throw CommonHttpException.details(
          `DetalheA #${one.id} não encontrou ClienteFavorecido #${one.clienteFavorecido.id}.`);
      }
      one.clienteFavorecido = favorecido;
    }
  }
}
