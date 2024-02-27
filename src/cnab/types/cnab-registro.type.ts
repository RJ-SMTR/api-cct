import { isArrayContainEqual } from 'src/utils/array-utils';
import { ICnabFieldMap } from '../interfaces/cnab-field-map.interface';
import { CnabFields } from './cnab-field.type';

export type CnabRegistro = {
  fields: CnabFields;
  fieldMap?: ICnabFieldMap;
};

export type CnabRegistroMapped = {
  fields: CnabFields;
  fieldMap: ICnabFieldMap;
};

export function isCnabRegistro(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), ['fields', 'fieldMap'])
  );
}
