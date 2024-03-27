
export interface CnabField {
  _metadata?: CnabFieldMetadata;
  pos: [number, number];
  picture: string;
  /** Default read value format is `string` */
  value: any;
  format?: CnabFieldFormat;
}

export interface CnabFieldAs<T> {
  _metadata?: CnabFieldMetadata;
  pos: [number, number];
  picture: string;
  value: any;
  /** Value before any conversion */
  format: CnabFieldFormatAs<T>;
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

export interface CnabFieldFormat {
  /** 
   * date-fns format to write in CNAB and read from CNAB.
   * 
   * Formatting is date-fns date format
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   * @example `ddMMyyyy`
   */
  dateFormat?: string;
  /** Format used to convert from Cnab text content into desired TypeScript format */
  formatType: 'string' | 'boolean' | 'Date' | 'number' | 'enum';
  /** If picture format is not the desired format, force convert into desired format */
  force?: boolean;
  /** Converted value. Used when reading CNAB to object */
  value?: any;
}

export interface CnabFieldFormatAs<T> {
  /** 
   * date-fns format to write in CNAB and read from CNAB.
   * 
   * Formatting is date-fns date format
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   * @example `ddMMyyyy`
   */
  dateFormat?: string;
  /** Format used to convert from Cnab text content into desired TypeScript format */
  formatType: 'string' | 'boolean' | 'Date' | 'number' | 'enum';
  /** If picture format is not the desired format, force convert into desired format */
  force?: boolean;
  /** Converted value. Used when reading CNAB to object */
  value: T;
}

export type CnabFields = Record<string, CnabField>;

export function isCnabField(obj: object): obj is CnabField {
  return 'pos' in obj && 'picture' in obj && 'value' in obj;
}
