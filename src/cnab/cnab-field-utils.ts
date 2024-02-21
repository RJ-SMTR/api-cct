import { format, isDate } from 'date-fns';
import { stringToDate } from 'src/utils/date-utils';
import {
  getStringNoSpecials,
  getStringUpperUnaccent,
  isStringBasicAlnumUpper,
} from 'src/utils/string-utils';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';

export type CropFillOnCrop = 'error' | 'cropLeft' | 'cropRight';

/**
 * From CnabField get formatted value applying Picture.
 *
 * And validate Cnab.
 */
export function getCnabPictureValue(item: CnabField) {
  validateCnabFieldPositionSize(item);
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
  validateCnabFieldType(item);

  return result;
}

export function validateCnabFieldType(item: CnabField) {
  if (item.value === null) {
    throw new Error('No formats allow null item value');
  }
}

/**
 * Integer: `9(<size number>)`.
 *
 * Decimal: There are two formats for decimal:
 * 1. "V" + 9999... The number of characters "9 after "V" is the length of decimal;
 * 2. `V9(<size number>)`.
 *
 * @throws `HttpException` if picture is invalid (regex has no matches).
 */
export function getPictureNumberSize(picture: string): {
  integer: number;
  decimal: number;
} {
  const regexResult = new RegExp(/^9\((\d+)\)(V(9+$|9\((\d+)\)))?$/g).exec(
    picture,
  );
  if (!regexResult) {
    throw new Error(`Picture "${picture}" returned no matches.`);
  }
  return {
    integer: Number(regexResult[1]) || 0,
    decimal:
      Number(regexResult[4]) ||
      (regexResult[3] ? String(regexResult[3]).length : 0),
  };
}

/**
 * Text size: `X(<sie number>)`.
 *
 * If regex doesn't find anything, the value is 0.
 *
 * @throws `HttpException` if picture is invalid (regex has no matches).
 */
export function getPictureTextSize(picture: string): number {
  const regexResult = new RegExp(/^X\((\d+?)\)$/g).exec(picture);
  if (!regexResult) {
    throw new Error(`Picture "${picture}" returned no matches.`);
  }
  return Number(regexResult[1]) || 0;
}

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
 * Formar original value to CNAB text.
 *
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
  throwIfInvalid = false,
) {
  validateFormatText(item);
  validateCnabText(item, throwIfInvalid);
  const size = getPictureTextSize(item.picture);
  return cropFillCnabField(
    getStringNoSpecials(getStringUpperUnaccent(item.value)),
    size,
    CnabFieldType.Text,
    onCrop,
  );
}

/**
 * Performs basic validation before formatting.
 */
function validateFormatText(item: CnabField) {
  if (typeof item.value !== 'string') {
    throw new Error(`CnabField value (${item.value}) is not string.`);
  }
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
  validateFormatDate(item);
  const { integer } = getPictureNumberSize(item.picture);
  const value =
    !isDate(item.value) && !item.dateFormat
      ? String(item.value)
      : String(format(stringToDate(item.value), item.dateFormat || 'yymmdd'));
  return cropFillCnabField(value, integer, CnabFieldType.Date, onCrop);
}

/**
 * Performs basic validation before formatting.
 */
function validateFormatDate(item: CnabField) {
  if (!item.dateFormat) {
    throw new Error(`CnabField must have dateFormat.`);
  }
  if (isNaN(stringToDate(item.value).getDate())) {
    throw new Error(`CnabField value (${item.value}) is not a valid date.`);
  }
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
  validateFormatNumber(item);
  const { integer, decimal } = getPictureNumberSize(item.picture);
  const result = Number(item.value).toFixed(decimal).replace('.', '');
  return cropFillCnabField(
    result,
    integer + decimal,
    CnabFieldType.Number,
    onCrop,
  );
}

/**
 * Performs basic validation before formatting.
 */
function validateFormatNumber(item: CnabField) {
  if (item.value === null || isNaN(Number(item.value))) {
    throw new Error(
      `CnabField value (${item.value}) is not a valid number value.`,
    );
  }
}

/**
 * Validates if CnabField input value is already following CNAB text value reccomendations:
 * - All characters must be UPPERCASE, Alphanumeric (A-z 0-9) and no Accent (no "á", "ê" etc).
 */
export function validateCnabText(
  item: CnabField,
  throwOnError = false,
): boolean {
  const isCnabTextValid =
    typeof item.value === 'string' && isStringBasicAlnumUpper(item.value);
  if (isCnabTextValid && throwOnError) {
    throw new Error(
      `CnabField value "${item.value}" formatting has invalid Text format.`,
    );
  }
  return isCnabTextValid;
}

/**
 * Validates if position matches Picture
 */
export function validateCnabFieldPositionSize(item: CnabField) {
  const pictureSize = getPictureTotalSize(item);
  const start = item.pos[0];
  const end = item.pos[1];
  const posSize = end + 1 - start;
  if (pictureSize < 1) {
    throw new Error(`CnabField picture should be >= 1 but is ${pictureSize}`);
  }
  if (start < 1) {
    throw new Error(
      `CnabField position start should be >= 1 but is ${item.pos[0]}`,
    );
  }
  if (end < start) {
    throw new Error(
      `CnabField position end should be >= start but positions are ${item.pos}`,
    );
  }
  if (pictureSize !== posSize) {
    throw new Error(
      `CnabField picture and position doesnt match ` +
        `(positionSize: ${posSize}, pictureSize: ${pictureSize})`,
    );
  }
}

function getPictureTotalSize(item: CnabField) {
  return getCnabFieldType(item) === CnabFieldType.Text
    ? getPictureTextSize(item.picture)
    : ((i = getPictureNumberSize(item.picture)) => i.decimal + i.integer)();
}
