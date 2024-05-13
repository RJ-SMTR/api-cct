import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * @extends {CnabFields}
 * 
 * @example `1040001300012Z                                                                A94477960174775103A993000                                                                                                                                         `
 */
export interface CnabDetalheZ_104 {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  usoExclusivoFebraban: CnabField;
  codigoDetalheZ: CnabField;
  usoExclusivoFebraban2: CnabField;
}
