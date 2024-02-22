import { isArrayContainEqual } from 'src/utils/array-utils';
import { ICnabRegistroFieldMap } from '../interfaces/cnab-registro-field-map.interface';
import { CnabRegistro } from './cnab-registro.type';

export type CnabRegistroMapped = {
  registro: CnabRegistro;
  fieldMap: ICnabRegistroFieldMap;
};

export function isCnabRegistroMapped(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), ['registro', 'fieldMap'])
  );
}
