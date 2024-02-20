import { CnabField } from '../types/cnab-field.type';
import { ICnabRegistroBase } from './cnab-registro-base.interface';

export interface ICnabDetalheBase extends ICnabRegistroBase {
  nsr: CnabField;
  codigoSegmento: CnabField;
}
