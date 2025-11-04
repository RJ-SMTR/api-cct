import { Injectable, Logger } from '@nestjs/common';
import { CnabDetalheE_104V030 } from 'src/configuration/cnab/interfaces/cnab-240/104/extrato/cnab-detalhe-e-104-v030.interface';
import { ExtratoDetalheE } from 'src/domain/entity/extrato-detalhe-e.entity';
import { ExtratoHeaderLote } from 'src/domain/entity/extrato-header-lote.entity';
import { ExtratoDetalheERepository } from 'src/repository/extrato-detalhe-e.repository';
import { logWarn } from 'src/utils/log-utils';
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
      loteServico: detalheE_104.loteServico.convertedValue,
      nsr: detalheE_104.nsr.convertedValue,
      tipoInscricao: detalheE_104.tipoInscricao.stringValue,
      numeroInscricao: detalheE_104.numeroInscricao.stringValue,
      codigoConvenioBanco: detalheE_104.codigoConvenioBanco.stringValue,
      agencia: detalheE_104.agencia.stringValue,
      dvAgencia: detalheE_104.dvAgencia.stringValue,
      conta: detalheE_104.conta.stringValue,
      dvConta: detalheE_104.dvConta.stringValue,
      dvAgenciaConta: detalheE_104.dvAgenciaConta.stringValue,
      nomeEmpresa: detalheE_104.nomeEmpresa.convertedValue,
      dataLancamento: detalheE_104.dataLancamento.convertedValue,
      tipoLancamento: detalheE_104.tipoLancamento.stringValue,
      categoriaLancamento: detalheE_104.categoriaLancamento.stringValue,
      codigoHistoricoBanco: detalheE_104.codigoHistoricoBanco.stringValue,
      descricaoHistoricoBanco: detalheE_104.descricaoHistoricoBanco.convertedValue,
      numeroDocumento: detalheE_104.numeroDocumento.stringValue,
      valorLancamento: detalheE_104.valorLancamento.convertedValue,
    });
    const saved = await this.extDetalheERepository.saveIfNotExists(detalheE);
    if (!saved.isNewItem) {
      logWarn(this.logger, 'ExtratoDetalheE já existe, ignorando...');
    }
    return saved.item;
  }

  public async save(obj: DeepPartial<ExtratoDetalheE>): Promise<ExtratoDetalheE> {
    return await this.extDetalheERepository.save(obj);
  }

  public async findOne(fields: EntityCondition<ExtratoDetalheE>,): Promise<Nullable<ExtratoDetalheE>> {
    return await this.extDetalheERepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoDetalheE>,
  ): Promise<ExtratoDetalheE[]> {
    return await this.extDetalheERepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extDetalheERepository.getNextNumeroDocumento(date);
  }
}
