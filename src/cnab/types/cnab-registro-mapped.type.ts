import { ICnabRegistroFieldMap } from '../interfaces/cnab-registro-field-map.interface';
import { CnabRegistro } from './cnab-registro.type';

export type CnabRegistroMapped = {
  registro: CnabRegistro;
  fieldMap: ICnabRegistroFieldMap;
};
