import { CnabField } from '../../../types/cnab-field.type';

export interface ICnab240CaixaHeaderLote {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabField;
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
  ocorrencias: CnabField;
}
