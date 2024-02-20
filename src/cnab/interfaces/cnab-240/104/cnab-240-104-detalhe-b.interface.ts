import { CnabField } from '../../../types/cnab-field.type';

export interface ICnab240CaixaDetalheB {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabField;
  nsr: CnabField;
  codigoSegmento: CnabField;
  usoExclusivoFebraban: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  logradouro: CnabField;
  numeroLocal: CnabField;
  complemento: CnabField;
  bairro: CnabField;
  cidade: CnabField;
  cep: CnabField;
  complementoCep: CnabField;
  siglaEstado: CnabField;
  dataVencimento: CnabField;
  valorDocumento: CnabField;
  valorAbatimento: CnabField;
  valorDesconto: CnabField;
  valorMora: CnabField;
  valorMulta: CnabField;
  codigoDocumentoFavorecido: CnabField;
  usoExclusivoFebraban2: CnabField;
}
