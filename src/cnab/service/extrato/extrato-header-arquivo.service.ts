import { Injectable, Logger } from '@nestjs/common';
import { ExtratoHeaderArquivo } from 'src/cnab/entity/extrato/extrato-header-arquivo.entity';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { ExtratoHeaderArquivoRepository } from 'src/cnab/repository/extrato/extrato-header-arquivo.repository';
import { logWarn } from 'src/utils/log-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, EntityManager } from 'typeorm';
import { ExtratoDto } from '../dto/extrato.dto';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';

@Injectable()
export class ExtratoHeaderArquivoService {
  

  private logger: Logger = new Logger('ExtratoHeaderArquivoService', { timestamp: true });

  constructor(private extHeaderArquivoRepository: ExtratoHeaderArquivoRepository,
    private readonly entityManager:EntityManager) { }

  public async save(obj: DeepPartial<ExtratoHeaderArquivo>): Promise<ExtratoHeaderArquivo> {
    return await this.extHeaderArquivoRepository.save(obj);
  }

  public async saveFrom104(header: CnabHeaderArquivo104): Promise<SaveIfNotExists<ExtratoHeaderArquivo>> {
    // Save Header Arquivo
    const extratoHeaderArquivo = new ExtratoHeaderArquivo({
      tipoArquivo: header.tipoArquivo.convertedValue,
      codigoBanco: header.codigoBanco.stringValue,
      tipoInscricao: header.tipoInscricao.stringValue,
      numeroInscricao: header.numeroInscricao.stringValue,
      codigoConvenio: header.codigoConvenioBanco.stringValue,
      parametroTransmissao: header.parametroTransmissao.stringValue,
      agencia: header.agenciaContaCorrente.stringValue,
      dvAgencia: header.dvAgencia.stringValue,
      numeroConta: header.numeroConta.stringValue,
      dvConta: header.dvConta.stringValue,
      nomeEmpresa: header.nomeEmpresa.convertedValue,
      dataGeracao: header.dataGeracaoArquivo.convertedValue,
      horaGeracao: header.horaGeracaoArquivo.convertedValue,
      nsa: header.nsa.convertedValue,
    });
    const saveHA = await this.extHeaderArquivoRepository.saveIfNotExists(extratoHeaderArquivo);
    if (!saveHA.isNewItem) {
      logWarn(this.logger, 'ExtratoHeaderArquivo já existe, ignorando...');
    }
    return saveHA;
  }

  public async findOne(fields: EntityCondition<ExtratoHeaderArquivo>,): Promise<Nullable<ExtratoHeaderArquivo>> {
    return await this.extHeaderArquivoRepository.findOne({
      where: fields
    });
  }

  public async findMany(
    fields: EntityCondition<ExtratoHeaderArquivo>,
  ): Promise<ExtratoHeaderArquivo[]> {
    return await this.extHeaderArquivoRepository.findMany({
      where: fields
    });
  }

  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.extHeaderArquivoRepository.getNextNumeroDocumento(date);
  }
 
 
 public async getExtrato(_conta: string, _dt_inicio: number,
    _dt_fim: number,_tipoLancamento: string
 ):Promise<ExtratoDto[]>{
    _conta = (_conta ==="cett")?PagadorContaEnum.CETT:PagadorContaEnum.ContaBilhetagem;
   
    return await this.entityManager.query(`select dthe."dataLancamento",
    dthe.nsr as processo,
    'Doc:'|| dthe."numeroInscricao"||'Ag.: '|| dthe.agencia || '-' || dthe."dvAgencia"||
   'Conta: '|| dthe.conta ||'-'|| dthe."dvConta" as lancamento, 
   'Doc: '||dthe."numeroInscricao"||'Ag.: '||dthe.agencia||'-'||dthe."dvAgencia"||
   'Conta: '||dthe.conta||'-'||dthe."dvConta" as operacao,
    dthe."tipoLancamento" as tipo,
    dthe."valorLancamento" as valor   
   FROM public.extrato_header_arquivo ha inner join public.extrato_header_lote ehl 
                                         on ha.id = ehl."extratoHeaderArquivoId" 
                                         inner join public.extrato_detalhe_e dthe 
                                         on ehl.id = dthe."extratoHeaderLoteId" 
                                         where ha."numeroConta" =${_conta}
                                        and dthe."tipoLancamento" =${_tipoLancamento}
                                        and dthe."dataLancamento" between (${_dt_inicio} and ${_dt_fim})`);
 }
  
}