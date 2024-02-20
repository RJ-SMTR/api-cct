import { format, isDate } from 'date-fns';
import { stringToDate } from 'src/utils/date-utils';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';
import { CnabLote, isCnabLote } from './types/cnab-lote.type';
import { CnabRegistro } from './types/cnab-registro.type';
import {
  getStringNoSpecials,
  getStringUppercaseUnaccent,
} from 'src/utils/string-utils';

/**
 * Convert CNAB Registro into CNAB file line
 */
export function getRegistroLine(registro: CnabRegistro) {
  let line = '';
  for (const value of Object.values(registro)) {
    line += getCnabPictureValue(value);
  }
  return line;
}

/**
 * From CnabField get formatted value applying Picture
 */
export function getCnabPictureValue(item: CnabField) {
  if (getCnabFieldType(item) === CnabFieldType.Date) {
    return formatDate(item);
  } else if (getCnabFieldType(item) === CnabFieldType.Number) {
    return formatNumber(item);
  } else {
    // Text
    return formatText(item);
  }
}
export function getCnabFieldType(item: CnabField): CnabFieldType {
  let result: CnabFieldType | undefined = undefined;
  if (item.picture.startsWith('9')) {
    if (item.dateFormat) {
      result = CnabFieldType.Date;
    } else {
      result = CnabFieldType.Number;
    }
  } else if (item.picture.startsWith('X')) {
    result = CnabFieldType.Text;
  }

  if (!result) {
    throw new Error(`Cant recognize picture for ${item.picture}`);
  }
  validateFieldFormat(item);

  return result;
}

export function validateFieldFormat(item: CnabField) {
  if (item.value === null) {
    throw new Error('No formats allow null item value');
  } else if (isNaN(Number(item.value))) {
    throw new Error('Number format cant represent NaN value');
  }
}

export function regexPicture(exp: any, picture: any) {
  const regexResult = new RegExp(exp).exec(picture) || [];
  const lengthResult = [
    Number(regexResult[1]) || 0,
    Number(regexResult[3]) || 0,
  ];
  return lengthResult;
}

/**
 * Integer: `9(<size number>)`.
 *
 * Decimal: There are two formats for decimal:
 * 1. "V9" + 9999... The number of characters "9 after "V9" is the length of decimal;
 * 2. `V9(<size number>)`.
 *
 * If regex doesn't find anything, the value is 0.
 */
export function getPictureNumberSize(picture: string): {
  integer: number;
  decimal: number;
} {
  const regexResult =
    new RegExp(/9\((\d+)\)(V9(9+|\((\d+)\)))?/g).exec(picture) || [];
  return {
    integer: Number(regexResult[1]) || 0,
    decimal:
      Number(regexResult[4]) ||
      ((i = regexResult[2] || '') => (/^V999*$/g.test(i) ? i.length - 2 : 0))(),
  };
}

/**
 * Text size: `X(<sie number>)`.
 *
 * If regex doesn't find anything, the value is 0.
 */
export function getPictureTextSize(picture: string): number {
  const regexResult = new RegExp(/X\((\d+?)\)/g).exec(picture) || [];
  return Number(regexResult[1]) || 0;
}

export type CropFillOnCrop = 'error' | 'cropLeft' | 'cropRight';

export function cropFillCnabField(
  value: string,
  maxSize: number,
  fieldType: CnabFieldType,
  onCrop: CropFillOnCrop = 'cropRight',
): string {
  if (value.length > maxSize && onCrop === 'error') {
    throw new Error(
      `Value "${value}" is too big to fit Picture (maxSize = ${maxSize})`,
    );
  }

  const sizeOffset = ((i = value.length - maxSize) => (i > 0 ? i : 0))();
  const cropped =
    onCrop === 'cropLeft'
      ? String(value).slice(sizeOffset)
      : String(value).slice(0, maxSize);
  const filled =
    fieldType === CnabFieldType.Text
      ? cropped.padEnd(maxSize, ' ')
      : cropped.padStart(maxSize, '0');
  return filled;
}

/**
 * Alphanumeric (picture X): text on the left, fill spaces on the right, uppercase only.
 *
 * - Any lowercase characters ("a", "c" etc) will be converted to uppercase ones;
 * - Any accented characters ("Á", "Ç" etc) will be converted to normal ones;
 * - Any special characters ("?", "!" etc) wil be removed.
 *
 * Unused fields must be filled with spaces.
 */
export function formatText(
  item: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
) {
  const size = getPictureTextSize(item.picture);
  return cropFillCnabField(
    getStringNoSpecials(getStringUppercaseUnaccent(item.value)),
    size,
    CnabFieldType.Text,
    onCrop,
  );
}

/**
 * Format cnab field as date string
 *
 * @param item for string date, dateFormat must folow these examples:
 * - `kkmmss` =  "992359"
 * - `ddMMyyyy` = "31122024"
 * - `ddMMyy` =  "311230"
 *
 * String value is string date it must be compatible with `new Date(<originalValue>)`.
 * If value is string date and there is no date format, the original value will be used.
 *
 * For Date object you must use dateFormat, otherwise it will use default date format.
 *
 * @see{@link https://date-fns.org/v3.3.1/docs/format} for date format
 */
export function formatDate(
  item: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
): string {
  const { integer } = getPictureNumberSize(item.picture);
  const value =
    !isDate(item.value) && !item.dateFormat
      ? String(item.value)
      : String(format(stringToDate(item.value), item.dateFormat || 'yymmdd'));
  return cropFillCnabField(value, integer, CnabFieldType.Date, onCrop);
}

/**
 * Numeric (picture 9): numeric text on the right, zeroes on the left,
 * unused fields must be filled with zeroes.
 *
 * Decimal indicator (picture V): indicates number of decimal places.
 * Example: if picture is "9(5)V9(2)" or "9(5)V999" the number "876,5432" must be "0087654".
 */
export function formatNumber(
  item: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
): string {
  const { integer, decimal } = getPictureNumberSize(item.picture);
  const result = Number(item.value).toFixed(decimal).replace('.', '');
  return cropFillCnabField(
    result,
    integer + decimal,
    CnabFieldType.Number,
    onCrop,
  );
}

export function getPlainRegistros(
  cnab: Record<string, CnabRegistro | CnabRegistro[] | CnabLote[]>,
): CnabRegistro[] {
  // return
  const plainCnab: CnabRegistro[] = [];
  for (const value of Object.values(cnab)) {
    if (Array.isArray(value)) {
      if (isCnabLote(value)) {
        for (const lote of value as CnabLote[]) {
          plainCnab.push(...getPlainRegistros(lote));
        }
      } else {
        plainCnab.push(...(value as CnabRegistro[]));
      }
    } else {
      plainCnab.push(value);
    }
  }
  return plainCnab;
}
