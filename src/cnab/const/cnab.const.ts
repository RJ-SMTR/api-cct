import { CnabFieldFormat, CnabFieldFormatAs } from "../interfaces/cnab-field.interface";

export const CNAB_LAYOUTS = [240];

export const CNAB_EOL = '\r\n';

export const CnabConst = {
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmmss',
  format: {
    string: () => ({ formatType: 'string' } as CnabFieldFormatAs<string>),
    stringForce: () => ({ formatType: 'string', force: true } as CnabFieldFormatAs<string>),
    number: () => ({ formatType: 'number' } as CnabFieldFormatAs<number>),
    enum: () => ({ formatType: 'enum' } as CnabFieldFormat),
    nullableDate: () => ({ dateFormat: 'ddMMyyyy', formatType: 'NullableDate' } as CnabFieldFormatAs<Date | null>),
    dateFormat: () => ({ dateFormat: 'ddMMyyyy', formatType: 'Date' } as CnabFieldFormatAs<Date>),
    timeFormat: () => ({ dateFormat: 'HHmmss', formatType: 'Date' } as CnabFieldFormatAs<Date>),
  },

  /** 
   * DDMMAAAA
   * 
   * @example '18122000'
   */
  cnabDateOutput: 'ddMMyyyy',

  /**
   * HHMMSS - hour is 0-23
   * 
   * @example '235911'
   */
  cnabTimeOutput: 'HHmmss',

  dateObjOutput: 'yyyy MM dd',
}