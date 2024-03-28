import { MetadataAs } from 'src/utils/interfaces/metadata.type';
import { ICnabFieldMap } from './cnab-all/cnab-field-map.interface';
import { CnabFields } from './cnab-field.interface';

export interface CnabRegistro {
  _metadata?: RegistroMetadata;
  fields: CnabFields;
  fieldMap?: ICnabFieldMap;
}

export interface CnabRegistroMapped {
  _metadata?: RegistroMetadata;
  fields: CnabFields;
  fieldMap: ICnabFieldMap;
}

export type RegistroMetadata =  MetadataAs<{
  type: 'CnabRegistro',
  name?: string,
}>

export function isCnabRegistro(value: any): value is CnabRegistro {
  return value?._metadata?.type === 'CnabRegistro';
}
