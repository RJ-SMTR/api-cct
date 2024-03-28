import { CnabField, CnabFieldAs, CnabFieldBase, CnabFieldFormat } from "../interfaces/cnab-field.interface";

const format = {
  string: () => ({ formatType: 'string' } as CnabFieldFormat),
  stringForce: () => ({ formatType: 'string', force: true } as CnabFieldFormat),
  number: () => ({ formatType: 'number' } as CnabFieldFormat),
  nullableDate: () => ({ dateFormat: 'ddMMyyyy', formatType: 'NullableDate' } as CnabFieldFormat),
  dateFormat: () => ({ dateFormat: 'ddMMyyyy', formatType: 'Date' } as CnabFieldFormat),
  timeFormat: () => ({ dateFormat: 'HHmmss', formatType: 'Date' } as CnabFieldFormat),
}

export const Cnab = {
  const: {
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
    /** End of line */
    eol: '\r\n',
    /** Available layouts */
    layouts: [240],
  },
  format: {
    string: format.string,
    stringForce: format.stringForce,
    number: format.number,
    nullableDate: format.nullableDate,
    dateFormat: format.dateFormat,
    timeFormat: format.timeFormat,
  },
  /** Constructor factory for CnabField objects */
  new: {
    default: (cnab: CnabFieldBase): CnabField => ({
      stringValue: '',
      convertedValue: undefined,
      ...cnab
    }),
    string: (cnab: CnabFieldBase): CnabFieldAs<string> => ({
      stringValue: '',
      convertedValue: '',
      format: format.string(),
      ...cnab
    }),
    stringForce: (cnab: CnabFieldBase): CnabFieldAs<string> => ({
      stringValue: '',
      convertedValue: '',
      format: format.stringForce(),
      ...cnab
    }),
    number: (cnab: CnabFieldBase): CnabFieldAs<number> => ({
      stringValue: '',
      convertedValue: NaN,
      format: format.number(),
      ...cnab
    }),
    date: (cnab: CnabFieldBase): CnabFieldAs<Date> => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.dateFormat(),
      ...cnab
    }),
    time: (cnab: CnabFieldBase): CnabFieldAs<Date> => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.timeFormat(),
      ...cnab
    }),
    nullableDate: (cnab: CnabFieldBase): CnabFieldAs<Date | null> => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.nullableDate(),
      ...cnab
    }),
  },
  /** Insert boilerplate properties of new Cnab */
  insert: {
    /** Default */
    d: () => ({
      stringValue: '',
      convertedValue: undefined,
    }),
    string: () => ({
      stringValue: '',
      convertedValue: '',
      format: format.string(),
    }),
    stringForce: () => ({
      stringValue: '',
      convertedValue: '',
      format: format.stringForce(),
    }),
    number: () => ({
      stringValue: '',
      convertedValue: NaN,
      format: format.number(),
    }),
    date: () => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.dateFormat(),
    }),
    time: () => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.timeFormat(),
    }),
    nullableDate: () => ({
      stringValue: '',
      // Invalid date to represent null/unused value
      convertedValue: new Date(''),
      format: format.nullableDate(),
    }),
  },
}