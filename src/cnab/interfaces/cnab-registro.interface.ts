import { ICnabFieldMap } from './cnab-all/cnab-field-map.interface';
import { CnabFields } from './cnab-field.interface';

export interface CnabRegistro {
  _type: 'CnabRegistro';
  _metadata?: RegistroMetadata;
  fields: CnabFields;
  fieldMap?: ICnabFieldMap;
}

export interface CnabRegistroMapped {
  _metadata?: RegistroMetadata;
  fields: CnabFields;
  fieldMap: ICnabFieldMap;
}

export interface RegistroMetadata {
  name?: string;
}

export function isCnabRegistro(value: any): value is CnabRegistro {
  return value?._type === 'CnabRegistro';
}
