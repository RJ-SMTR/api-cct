import { isArrayContainEqual } from 'src/utils/array-utils';
import { ICnabRegistroFieldMap } from '../interfaces/cnab-registro-field-map.interface';
import { CnabFields } from './cnab-field.type';

export type CnabRegistro = {
  fields: CnabFields;
  fieldMap?: ICnabRegistroFieldMap;
};

export type CnabRegistroMapped = {
  fields: CnabFields;
  fieldMap: ICnabRegistroFieldMap;
};

export function isCnabRegistro(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), ['fields', 'fieldMap'])
  );
}
