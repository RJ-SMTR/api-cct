
/**
 * Minimal content used as constructor args
 */
export interface CnabFieldBase {
  _metadata?: CnabFieldMetadata;
  format?: CnabFieldFormat;

  pos: [number, number];
  picture: string;
  /** Input value format is `string` */
  value: any;
}

export interface CnabField extends CnabFieldBase {
  _metadata?: CnabFieldMetadata;
  format?: CnabFieldFormat;

  pos: [number, number];
  picture: string;
  /** Input value. */
  value: any;

  /** Value generated after stringify from object to CNAB text output */
  stringValue: string;
  /** Used when reading CNAB to object */
  convertedValue: any;
}

export interface CnabFieldAs<T> extends CnabField {
  convertedValue: T;
  format: CnabFieldFormat;
}

/**
 * Debug metadata for CnabField.
 */
export interface CnabFieldMetadata {
  /** Field name */
  name?: string,
  /** Registro name */
  registro?: string,
  /** Cnab name */
  cnab?: string,
  registroIndex?: number,
}

/**
 * Info used to handle formatting.
 */
export interface CnabFieldFormat {
  /** Format used to convert from Cnab text content into desired TypeScript format */
  formatType: CnabFieldFormatType;
  /** 
   * date-fns format to write in CNAB and read from CNAB.
   * 
   * Formatting is date-fns date format
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   * @example `ddMMyyyy`
   */
  dateFormat?: string;
  /** If field is considered null */
  null?: boolean;
  /** If picture format is not the desired format, force convert into desired format */
  force?: boolean;
}

export type CnabFieldFormatType =
  'string' | 'nullableString' |
  'boolean' |
  'Date' | 'nullableDate' |
  'number' | 'nullableNumber'
'enum';

export type CnabFields = Record<string, CnabField>;

export function isCnabField(obj: object): obj is CnabField {
  return 'pos' in obj && 'picture' in obj && 'value' in obj;
}
