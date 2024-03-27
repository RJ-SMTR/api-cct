import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabDetalheB_104 {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
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
