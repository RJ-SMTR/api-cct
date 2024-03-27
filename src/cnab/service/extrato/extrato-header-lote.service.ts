import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from 'src/cnab/entity/extrato/extrato-header-lote.entity';
import { CnabHeaderLote104Extrato } from 'src/cnab/interfaces/cnab-240/104/extrato/cnab-header-lote-104-extrato.interface';
import { ExtratoHeaderLoteRepository } from 'src/cnab/repository/extrato/extrato-header-lote.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoHeaderLoteService {
  private logger: Logger = new Logger('ExtratoHeaderLoteService', { timestamp: true });

  constructor(private extHeaderLoteRepository: ExtratoHeaderLoteRepository) { }

  public async saveFrom104(header: CnabHeaderLote104Extrato, headerArquivo: ExtratoHeaderArquivo
  ): Promise<ExtratoHeaderLote> {
    // Save Header Arquivo
    const extratoHeaderLote = new ExtratoHeaderLote({
      extratoHeaderArquivo: { id: headerArquivo.id },
      loteServico: header.loteServico.format.value,
      tipoInscricao: header.tipoInscricao.value,
      numeroInscricao: header.numeroInscricao.value,
      codigoConvenioBanco: header.codigoConvenioBanco.value,
      dataSaldoInicial: header.dataSaldoInicial.format.value,
      valorSaldoInicial: header.valorSaldoInicial.format.value,
      situacaoSaldoInicial: header.situacaoSaldoInicial.value,
      posicaoSaldoInicial: header.posicaoSaldoInicial.value,
      tipoMoeda: header.tipoMoeda.value,
    });
    const saveHL = await this.extHeaderLoteRepository.saveIfNotExists(extratoHeaderLote);
    if (!saveHL.isNewItem) {
      this.logger.warn('ExtratoHeaderLote já existe, ignorando...');
    }
    return saveHL.item;
  }

  public async save(obj: DeepPartial<ExtratoHeaderLote>): Promise<ExtratoHeaderLote> {
    return await this.extHeaderLoteRepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderLote> | EntityCondition<ExtratoHeaderLote>[],): Promise<Nullable<ExtratoHeaderLote>> {
    return await this.extHeaderLoteRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderLote> | EntityCondition<ExtratoHeaderLote>[],
  ): Promise<ExtratoHeaderLote[]> {
    return await this.extHeaderLoteRepository.findMany({
      where: fields
    });
  }
}
