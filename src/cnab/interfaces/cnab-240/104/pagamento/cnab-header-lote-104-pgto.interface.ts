import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
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
