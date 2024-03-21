import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { ExtratoHeaderArquivoRepository } from 'src/cnab/repository/extrato/extrato-header-arquivo.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoHeaderArquivoService {
  private logger: Logger = new Logger('ExtratoHeaderArquivoService', { timestamp: true });

  constructor(private extratoHeaderArquivoRepository: ExtratoHeaderArquivoRepository) { }

  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.extratoHeaderArquivoRepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderArquivo> | EntityCondition<ExtratoHeaderArquivo>[],): Promise<Nullable<ExtratoHeaderArquivo>> {
    return await this.extratoHeaderArquivoRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderArquivo> | EntityCondition<ExtratoHeaderArquivo>[],
  ): Promise<ExtratoHeaderArquivo[]> {
    return await this.extratoHeaderArquivoRepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extratoHeaderArquivoRepository.getNextNumeroDocumento(date);
  }
}
