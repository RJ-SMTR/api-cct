import { isDate } from 'date-fns';
import format from 'date-fns/format';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';
import { CnabRegistro } from './types/cnab-registro.type';
import { CnabLote, isCnabLote } from './types/cnab-lote.type';

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
  if (getCnabFieldType(item) === CnabFieldType.Currency) {
    return formatCurrency(item);
  } else if (getCnabFieldType(item) === CnabFieldType.Date) {
    return formatDate(item);
  } else if (getCnabFieldType(item) === CnabFieldType.Number) {
    return formatNumber(item);
  } else {
    // Text
    return formatCnabText(item);
  }
}
export function getCnabFieldType(item: CnabField): CnabFieldType {
  let result: CnabFieldType | undefined = undefined;
  if (item.picture.indexOf('V9') > 0) {
    result = CnabFieldType.Currency;
  } else if (item.picture.startsWith('9')) {
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
  const lenghtResult = [
    Number(regexResult[1]) || 0,
    Number(regexResult[3]) || 0,
  ];
  return lenghtResult;
}

/**
 * Integer: `9(<size number>)`.
 *
 * Decimal: There are two formats for decimal:
 * 1. "V9" + 9999... The number of characters "9 after "V9" is the lenght of decimal;
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
export function getPictureTextSize(item: CnabField): number {
  const regexResult = new RegExp(/X\((\d+?)\)/g).exec(item.picture) || [];
  return Number(regexResult[0]) || 0;
}

/**
 * Alphanumeric (picture X): text on the left, fill spaces on the right, uppercase only.
 *
 * Recommended no special characters (e.g. "Ç", "?", "Á" etc).
 *
 * Unused fields must be filled with spaces.
 */
export function formatCnabText(item: CnabField) {
  const out = regexPicture(/X\((\w+?)\)/g, item.picture);
  const size = Number(out[0]);
  return String(item.value).slice(0, size).padEnd(size, ' ');
}

/**
 * Numeric (picture 9): numeric text on the right, zeroes on the left,
 * unused fields must be filled with zeroes.
 *
 * Decimal indicator (picture V): indicates number of decimal places.
 * Example: if picture is "9(5)V9(2)" or "9(5)V999" the number "876,54" must be "0087654".
 */
export function formatNumber(item: CnabField): string {
  const out = regexPicture(/9\((\d+?)\)/g, item.picture);
  const size = Number(out[0]);
  return String(Number(item.value).toFixed(0)).padStart(size, '0');
}

/**
 * Format cnab field as date string
 *
 * @param item for string data inputs use only numbers:
 * - `HHMMSS` = "992359"
 * - `ddMMyyyy` = "31121030"
 * - `ddMMyy` = "311230"
 */
export function formatDate(item: CnabField) {
  if (isDate(item.value) && item.dateFormat) {
    return format(item.value, item.dateFormat);
  } else {
    const out = regexPicture(/9\((\w+?)\)/g, item.picture);
    const itemValue = String(item.value);
    const size = Number(out[0]);
    return itemValue.slice(size).padStart(size, '0');
  }
}

export function formatCurrency(item: CnabField) {
  const out = regexPicture(/9\((\d+)\)(V(9+))?/g, item.picture);
  const integer = Number(out[0]);
  const decimal = Number(out[1]) || 0;
  const result = String(Number(item.value).toFixed(decimal))
    .replace('.', '')
    .padStart(integer + decimal, '0');
  if (result.length > integer + decimal) {
    throw new Error(
      `Number "${result}" is too big to fit Currency Picture ` +
        `${item.picture} (picture lenght: ${integer + decimal})`,
    );
  }
  return result;
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
