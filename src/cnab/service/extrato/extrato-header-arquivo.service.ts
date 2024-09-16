import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CnabHeaderArquivo104 } from 'src/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto';
import { ExtratoHeaderArquivoRepository } from 'src/cnab/repository/extrato/extrato-header-arquivo.repository';
import { logWarn } from 'src/utils/log-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, EntityManager } from 'typeorm';
import { ExtratoDto } from '../dto/extrato.dto';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
import { compactQuery } from 'src/utils/console-utils';

@Injectable()
export class ExtratoHeaderArquivoService {
  private logger: Logger = new Logger('ExtratoHeaderArquivoService', {
    timestamp: true,
  });

  constructor(private extHeaderArquivoRepository: ExtratoHeaderArquivoRepository, private readonly entityManager: EntityManager) {}

  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.extHeaderArquivoRepository.save(obj);
  }

  public async saveFrom104(arquivo: CnabHeaderArquivo104, cnabName: string): Promise<SaveIfNotExists<ExtratoHeaderArquivo>> {
    // Save Header Arquivo
    const extratoHeaderArquivo = new ExtratoHeaderArquivo({
      tipoArquivo: arquivo.tipoArquivo.convertedValue,
      codigoBanco: arquivo.codigoBanco.stringValue,
      tipoInscricao: arquivo.tipoInscricao.stringValue,
      numeroInscricao: arquivo.numeroInscricao.stringValue,
      codigoConvenio: arquivo.codigoConvenioBanco.stringValue,
      parametroTransmissao: arquivo.parametroTransmissao.stringValue,
      agencia: arquivo.agenciaContaCorrente.stringValue,
      dvAgencia: arquivo.dvAgencia.stringValue,
      numeroConta: arquivo.numeroConta.stringValue,
      dvConta: arquivo.dvConta.stringValue,
      nomeEmpresa: arquivo.nomeEmpresa.convertedValue,
      dataGeracao: arquivo.dataGeracaoArquivo.convertedValue,
      horaGeracao: arquivo.horaGeracaoArquivo.convertedValue,
      nsa: arquivo.nsa.convertedValue,
      retornoName: cnabName,
    });
    const saveHA = await this.extHeaderArquivoRepository.saveIfNotExists(extratoHeaderArquivo);
    if (!saveHA.isNewItem) {
      logWarn(this.logger, 'ExtratoHeaderArquivo já existe, ignorando...');
    }
    return saveHA;
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderArquivo>): Promise<Nullable<ExtratoHeaderArquivo>> {
    return await this.extHeaderArquivoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(fields: EntityCondition<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo[]> {
    return await this.extHeaderArquivoRepository.findMany({
      where: fields,
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extHeaderArquivoRepository.getNextNumeroDocumento(date);
  }

  public async getExtrato(_conta: string, _dt_inicio: string, _dt_fim: string, _tipoLancamento?: string): Promise<ExtratoDto[]> {
    _conta = _conta === 'cett' ? PagadorContaEnum.CETT : PagadorContaEnum.ContaBilhetagem;

    const query = `
    SELECT ede."dataLancamento",
      ede.nsr AS processo,
      'Doc:'|| ede."numeroInscricao"||'Ag.: '|| ede.agencia || '-' || ede."dvAgencia"||
      'Conta: '|| ede.conta ||'-'|| ede."dvConta" AS lancamento, 
      'Doc: '||ede."numeroInscricao"||'Ag.: '||ede.agencia||'-'||ede."dvAgencia"||
      'Conta: '||ede.conta||'-'||ede."dvConta" AS operacao,
      ede."tipoLancamento" AS tipo,
      ede."valorLancamento" AS valor
    FROM public.extrato_header_arquivo ha
    INNER JOIN public.extrato_header_lote ehl on ha.id = ehl."extratoHeaderArquivoId" 
    INNER JOIN public.extrato_detalhe_e ede on ehl.id = ede."extratoHeaderLoteId" 
    WHERE ha."numeroConta" = '${_conta}' ${_tipoLancamento ? `\nAND ede."tipoLancamento" = '${_tipoLancamento}'` : ''}
    AND ede."dataLancamento" between '${_dt_inicio}' AND '${_dt_fim}'`;
    return await this.entityManager.query(compactQuery(query));
  }
}
