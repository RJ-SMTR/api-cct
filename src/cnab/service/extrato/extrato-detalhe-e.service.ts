import { Injectable, Logger } from '@nestjs/common';
import { ExtratoDetalheE } from 'src/cnab/entity/extrato/extrato-detalhe-e.entity';
import { ExtratoDetalheERepository } from 'src/cnab/repository/extrato/extrato-detalhe-e.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoDetalheEService {
  private logger: Logger = new Logger('ExtratoDetalheEService', { timestamp: true });

  constructor(private extratoDetalheERepository: ExtratoDetalheERepository) { }

  public async save(obj: DeepPartial<ExtratoDetalheE>): Promise<ExtratoDetalheE> {
    return await this.extratoDetalheERepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoDetalheE> | EntityCondition<ExtratoDetalheE>[],): Promise<Nullable<ExtratoDetalheE>> {
    return await this.extratoDetalheERepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoDetalheE> | EntityCondition<ExtratoDetalheE>[],
  ): Promise<ExtratoDetalheE[]> {
    return await this.extratoDetalheERepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extratoDetalheERepository.getNextNumeroDocumento(date);
  }
}
