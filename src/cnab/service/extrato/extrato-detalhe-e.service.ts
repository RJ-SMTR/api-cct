import { Injectable, Logger } from '@nestjs/common';
import { ExtratoDetalheE } from 'src/cnab/entity/extrato/extrato-detalhe-e.entity';
import { ExtratoHeaderLote } from 'src/cnab/entity/extrato/extrato-header-lote.entity';
import { CnabDetalheE_104V030 } from 'src/cnab/interfaces/cnab-240/104/extrato/cnab-detalhe-e-104-v030.interface';
import { ExtratoDetalheERepository } from 'src/cnab/repository/extrato/extrato-detalhe-e.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial } from 'typeorm';

@Injectable()
export class ExtratoDetalheEService {
  private logger: Logger = new Logger('ExtratoDetalheEService', { timestamp: true });

  constructor(private extDetalheERepository: ExtratoDetalheERepository) { }

  public async saveFrom104(detalheE_104: CnabDetalheE_104V030, headerLote: ExtratoHeaderLote
  ): Promise<ExtratoDetalheE> {
    // Save Header Arquivo
    const detalheE = new ExtratoDetalheE({
      extratoHeaderLote: { id: headerLote.id },
      loteServico: detalheE_104.loteServico.format.value,
      nsr: detalheE_104.nsr.format.value,
      tipoInscricao: detalheE_104.tipoInscricao.value,
      numeroInscricao: detalheE_104.numeroInscricao.value,
      codigoConvenioBanco: detalheE_104.codigoConvenioBanco.value,
      agencia: detalheE_104.agencia.value,
      dvAgencia: detalheE_104.dvAgencia.value,
      conta: detalheE_104.conta.value,
      dvConta: detalheE_104.dvConta.value,
      dvAgenciaConta: detalheE_104.dvAgenciaConta.value,
      nomeEmpresa: detalheE_104.nomeEmpresa.format.value,
      dataLancamento: detalheE_104.dataLancamento.format.value,
      tipoLancamento: detalheE_104.tipoLancamento.value,
      categoriaLancamento: detalheE_104.categoriaLancamento.value,
      codigoHistoricoBanco: detalheE_104.codigoHistoricoBanco.value,
      descricaoHistoricoBanco: detalheE_104.descricaoHistoricoBanco.format.value,
      numeroDocumento: detalheE_104.numeroDocumento.value,
      valorLancamento: detalheE_104.valorLancamento.format.value,
    });
    const saved = await this.extDetalheERepository.saveIfNotExists(detalheE);
    if (!saved.isNewItem) {
      this.logger.warn('ExtratoDetalheE já existe, ignorando...');
    }
    return saved.item;
  }

  public async save(obj: DeepPartial<ExtratoDetalheE>): Promise<ExtratoDetalheE> {
    return await this.extDetalheERepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoDetalheE> | EntityCondition<ExtratoDetalheE>[],): Promise<Nullable<ExtratoDetalheE>> {
    return await this.extDetalheERepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoDetalheE> | EntityCondition<ExtratoDetalheE>[],
  ): Promise<ExtratoDetalheE[]> {
    return await this.extDetalheERepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extDetalheERepository.getNextNumeroDocumento(date);
  }
}
