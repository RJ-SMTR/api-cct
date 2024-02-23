import { isArrayContainEqual } from 'src/utils/array-utils';
import { ICnabRegistroFieldMap } from '../interfaces/cnab-registro-field-map.interface';
import { CnabField } from './cnab-field.type';

export type CnabRegistro = {
  fields: Record<string, CnabField>;
  fieldMap?: ICnabRegistroFieldMap;
};

export type CnabRegistroMapped = {
  fields: Record<string, CnabField>;
  fieldMap: ICnabRegistroFieldMap;
};

export function isCnabRegistro(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), ['fields', 'fieldMap'])
  );
}
