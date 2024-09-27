import { HeaderLoteDTO } from 'src/cnab/dto/pagamento/header-lote.dto';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { DeepPartial } from 'typeorm';

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 * 
 * @version v032 micro - FEV/2024
 * @extends {CnabFields}
 */
export interface CnabHeaderLote104Pgto {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  tipoOperacao: CnabField;
  tipoServico: CnabField;
  formaLancamento: CnabField;
  versaoLeiauteLote: CnabField;
  filler: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  codigoConvenioBanco: CnabField;
  tipoCompromisso: CnabField;
  codigoCompromisso: CnabField;
  parametroTransmissao: CnabField;
  filler2: CnabField;
  agenciaContaCorrente: CnabField;
  dvAgencia: CnabField;
  numeroConta: CnabField;
  dvConta: CnabField;
  dvAgenciaConta: CnabField;
  nomeEmpresa: CnabField;
  mensagemAviso: CnabField;
  logradouro: CnabField;
  numeroLocal: CnabField;
  /** @example "Apto 503" */
  complemento: CnabField;
  cidade: CnabField;
  /** @example "12345" */
  cep: CnabField;
  /** @example "678" */
  complementoCep: CnabField;
  /** @example "RJ" */
  siglaEstado: CnabField;
  usoExclusivoFebraban: CnabField;
  /**
   * Retorna o status de retorno do CNAB (Tabela G059)
   * @see `OcorrenciaEnum`
   */
  ocorrencias: CnabField;
}

export class CnabHeaderLote104PgtoDTO {
  constructor(dto: CnabHeaderLote104Pgto) {
    Object.assign(this, dto);
  }
  static fromDTO(headerLoteDTO: HeaderLoteDTO): CnabHeaderLote104Pgto {
    const headerLote104 = new CnabHeaderLote104PgtoDTO(structuredClone(Cnab104PgtoTemplates.file104.registros.headerLote));
    const headerArquivo = headerLoteDTO.headerArquivo as HeaderArquivo;
    const pagador = headerLoteDTO.pagador as DeepPartial<Pagador>;
    headerLote104.codigoConvenioBanco.value = headerLoteDTO.codigoConvenioBanco;
    headerLote104.numeroInscricao.value = headerLoteDTO.numeroInscricao;
    headerLote104.parametroTransmissao.value = headerLoteDTO.parametroTransmissao;
    headerLote104.tipoInscricao.value = headerLoteDTO.tipoInscricao;
    headerLote104.formaLancamento.value = headerLoteDTO.formaLancamento;
    headerLote104.codigoCompromisso.value = headerLoteDTO.codigoCompromisso;
    // Pagador
    headerLote104.agenciaContaCorrente.value = headerArquivo.agencia;
    headerLote104.dvAgencia.value = headerArquivo.dvAgencia;
    headerLote104.numeroConta.value = headerArquivo.numeroConta;
    headerLote104.dvConta.value = headerArquivo.dvConta;
    headerLote104.nomeEmpresa.value = headerArquivo.nomeEmpresa;
    // Pagador addresss
    headerLote104.logradouro.value = pagador.logradouro;
    headerLote104.numeroLocal.value = pagador.numero;
    headerLote104.complemento.value = pagador.complemento;
    headerLote104.cidade.value = pagador.cidade;
    headerLote104.cep.value = pagador.cep;
    headerLote104.complementoCep.value = pagador.complementoCep;
    headerLote104.siglaEstado.value = pagador.uf;
    return headerLote104;
  }

  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  tipoOperacao: CnabField;
  tipoServico: CnabField;
  formaLancamento: CnabField;
  versaoLeiauteLote: CnabField;
  filler: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  codigoConvenioBanco: CnabField;
  tipoCompromisso: CnabField;
  codigoCompromisso: CnabField;
  parametroTransmissao: CnabField;
  filler2: CnabField;
  agenciaContaCorrente: CnabField;
  dvAgencia: CnabField;
  numeroConta: CnabField;
  dvConta: CnabField;
  dvAgenciaConta: CnabField;
  nomeEmpresa: CnabField;
  mensagemAviso: CnabField;
  logradouro: CnabField;
  numeroLocal: CnabField;
  /** @example "Apto 503" */
  complemento: CnabField;
  cidade: CnabField;
  /** @example "12345" */
  cep: CnabField;
  /** @example "678" */
  complementoCep: CnabField;
  /** @example "RJ" */
  siglaEstado: CnabField;
  usoExclusivoFebraban: CnabField;
  /**
   * Retorna o status de retorno do CNAB (Tabela G059)
   * @see `OcorrenciaEnum`
   */
  ocorrencias: CnabField;
}