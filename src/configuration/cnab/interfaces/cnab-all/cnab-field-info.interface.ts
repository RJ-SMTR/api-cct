import { CnabField } from './cnab-field.interface';

/** CnabField with info */
export interface ICnabFieldInfo {
  cnabField: CnabField,
  metadata: {
    fieldName: string,
    registroName: string,
    cnabName?: string,
  }
}
