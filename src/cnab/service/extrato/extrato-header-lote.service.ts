import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderLote } from 'src/cnab/entity/extrato/extrato-header-lote.entity';
import { ExtratoHeaderLoteRepository } from 'src/cnab/repository/extrato/extrato-header-lote.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoHeaderLoteService {
  private logger: Logger = new Logger('ExtratoHeaderLoteService', { timestamp: true });

  constructor(private extratoHeaderArquivoRepository: ExtratoHeaderLoteRepository) { }

  public async save(obj: DeepPartial<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    return await this.extratoHeaderArquivoRepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderLote> | EntityCondition<ExtratoHeaderLote>[],): Promise<Nullable<ExtratoHeaderLote>> {
    return await this.extratoHeaderArquivoRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderLote> | EntityCondition<ExtratoHeaderLote>[],
  ): Promise<ExtratoHeaderLote[]> {
    return await this.extratoHeaderArquivoRepository.findMany({
      where: fields
    });
  }
}
