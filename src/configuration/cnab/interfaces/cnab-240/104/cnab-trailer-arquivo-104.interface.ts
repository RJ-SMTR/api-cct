import {
  CnabField,
  CnabFieldAs
} from '../../cnab-all/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabTrailerArquivo104 {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  usoExclusivoFebraban: CnabField;
  quantidadeLotesArquivo: CnabField;
  quantidadeRegistrosArquivo: CnabField;
  quantidadeContasConciliacao: CnabField;
  usoExclusivoFebraban2: CnabField;
}
