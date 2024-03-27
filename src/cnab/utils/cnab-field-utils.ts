import { format, isDate } from 'date-fns';
import { asNumber, asNumberStringDate, asStringNumber, asStringOrDateDate } from 'src/utils/pipe-utils';
import {
  getStringNoSpecials,
  getStringUpperUnaccent,
  isStringBasicAlnumUpper,
} from 'src/utils/string-utils';
import { CnabFieldType } from '../enums/cnab-field-type.enum';
import { CnabField, CnabFieldFormat } from '../interfaces/cnab-field.interface';
import { getCnabFieldNameLog } from './cnab-metadata-utils';

export type CropFillOnCrop = 'error' | 'cropLeft' | 'cropRight';

// #region stringifyCnabField

/**
 * From CnabField get formatted value applying Picture.
 *
 * With all validations.
 */
export function stringifyCnabField(field: CnabField): string {
  validateCnabField(field);
  return getStringFromCnabField(field);
}

/**
 * From CnabField get formatted value applying Picture.
 *
 * With necessary validation.
 */
export function getStringFromCnabField(field: CnabField): string {
  const cnabFieldType = getCnabFieldType(field);
  if (cnabFieldType === CnabFieldType.Date) {
    return formatDate(field);
  } else if (cnabFieldType === CnabFieldType.Number) {
    return formatNumber(field);
  } else {
    // Text
    return formatText(field);
  }
}

export function getCnabFieldType(field: CnabField): CnabFieldType {
  let result: CnabFieldType | undefined = undefined;
  if (field.picture.startsWith('9')) {
    if (field.format?.dateFormat) {
      result = CnabFieldType.Date;
    } else {
      result = CnabFieldType.Number;
    }
  } else if (field.picture.startsWith('X')) {
    result = CnabFieldType.Text;
  }

  if (!result) {
    throw new Error(`Cant recognize picture for ${field.picture}`);
  }
  validateCnabFieldType(field);

  return result;
}

export function validateCnabFieldType(field: CnabField) {
  if (field.value === null) {
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
 * @throws `Error` if picture is invalid (regex has no matches).
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
 * @throws `Error` if picture is invalid (regex has no matches).
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
  field: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
  throwIfInvalid = false,
) {
  validateFormatText(field);
  validateCnabText(field, throwIfInvalid);
  const size = getPictureTextSize(field.picture);
  return cropFillCnabField(
    getStringNoSpecials(getStringUpperUnaccent(field.value)),
    size,
    CnabFieldType.Text,
    onCrop,
  );
}

/**
 * Performs basic validation before formatting.
 *
 * @throws `Error` if field value is invalid
 */
function validateFormatText(field: CnabField) {
  if (typeof field.value !== 'string') {
    throw new Error(`CnabField is not string. ${cnabFieldToString(field)}`);
  }
}

/**
 * Format cnab field as date string
 *
 * @param field for string date, dateFormat must folow these examples:
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
 *
 * @throws `Error` if field value is invalid
 */
export function formatDate(
  field: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
): string {
  validateFormatDate(field);
  const { integer } = getPictureNumberSize(field.picture);
  let value: string;
  if (isDate(field.value)) {
    value = String(
      format(
        field.value,
        field.format?.dateFormat || 'yymmdd',
      ),
    );
  } else if (field.format?.dateFormat) {
    const strDate = asNumberStringDate(field.value, field.format?.dateFormat, getCnabFieldNameLog(field));
    const formatted = format(strDate, field.format?.dateFormat || 'yymmdd');
    const newValue = String(formatted);
    value = newValue;
  } else {
    value = String(field.value);
  }
  return cropFillCnabField(value, integer, CnabFieldType.Date, onCrop);
}

/**
 * Performs basic validation before formatting.
 */
function validateFormatDate(field: CnabField) {
  if (!field.format?.dateFormat) {
    throw new Error(`CnabField must have dateFormat. ${cnabFieldToString(field)}`);
  }
  try {
    if (isNaN(asStringOrDateDate(field.value, field.format?.dateFormat).getDate())) {
      throw new Error(`CnabField got an invalid date. ${cnabFieldToString(field)}`);
    }
  } catch (error) {
    throw new Error(`CnabField got an invalid date. ${cnabFieldToString(field)}`);

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
  field: CnabField,
  onCrop: CropFillOnCrop = 'cropRight',
): string {
  validateFormatNumber(field);
  const { integer, decimal } = getPictureNumberSize(field.picture);
  const result = Number(field.value).toFixed(decimal).replace('.', '');
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
function validateFormatNumber(field: CnabField) {
  if (field.value === null || isNaN(Number(field.value))) {
    throw new Error(
      `CnabField is not a valid number value. ${cnabFieldToString(field)}`,
    );
  }
}

/**
 * Validates if CnabField input value is already following CNAB text value reccomendations:
 * - All characters must be UPPERCASE, Alphanumeric (A-z 0-9) and no Accent (no "á", "ê" etc).
 */
export function validateCnabText(
  field: CnabField,
  throwOnError = false,
): boolean {
  const isCnabTextValid =
    typeof field.value === 'string' && isStringBasicAlnumUpper(field.value);
  if (isCnabTextValid && throwOnError) {
    throw new Error(
      `CnabField value has invalid Text format. ${cnabFieldToString(field)}`,
    );
  }
  return isCnabTextValid;
}

/**
 * Run all validations of CnabField
 */
export function validateCnabField(field: CnabField) {
  validateCnabFieldPositionSize(field);
}

/**
 * Validates if position matches Picture
 */
export function validateCnabFieldPositionSize(field: CnabField) {
  const pictureSize = getPictureTotalSize(field);
  const start = field.pos[0];
  const end = field.pos[1];
  const posSize = end + 1 - start;
  if (pictureSize < 1) {
    throw new Error(`CnabField picture should be >= 1 but is ${pictureSize}. ${cnabFieldToString(field)}`);
  }
  if (start < 1) {
    throw new Error(
      `CnabField position start should be >= 1 but is ${field.pos[0]}. ${cnabFieldToString(field)}`,
    );
  }
  if (end < start) {
    throw new Error(
      `CnabField position end should be >= start but positions are ${field.pos}. ${cnabFieldToString(field)}`,
    );
  }
  if (pictureSize !== posSize) {
    throw new Error(
      `CnabField picture and position doesnt match ` +
      `(positionSize: ${posSize}, pictureSize: ${pictureSize}). ${cnabFieldToString(field)}`,
    );
  }
}

export function getPictureTotalSize(field: CnabField) {
  return getCnabFieldType(field) === CnabFieldType.Text
    ? getPictureTextSize(field.picture)
    : ((i = getPictureNumberSize(field.picture)) => i.decimal + i.integer)();
}

// #endregion

// #region parseCnabField

export function parseCnabField(
  cnabStringLine: string,
  fieldDTO: CnabField,
): CnabField {
  const field = getCnabFieldFromString(cnabStringLine, fieldDTO);
  validateParseCnabField(field);
  parseCnabFieldValue(field);
  return field;
}

function parseCnabFieldValue(field: CnabField) {
  const cnabFieldType = getCnabFieldType(field);
  if (field.format?.force) {
    if (field.format.formatType === 'Date') {
      parseDate(field);
    } else if (field.format.formatType === 'number') {
      parseNumber(field);
    } else {
      // default: text
      parseText(field);
    }
  } else {
    if (cnabFieldType === CnabFieldType.Date) {
      parseDate(field);
    } else if (cnabFieldType === CnabFieldType.Number) {
      parseNumber(field);
    } else {
      parseText(field);
    }
  }
}

/**
 * If no format defined, set format as Date
 */
export function parseDate(field: CnabField) {
  if ((field?.format && field.format?.formatType !== 'Date') || !field?.format?.dateFormat) {
    throw new Error(`Expected CnabFieldAs<Date> with defined dateFormat. ${JSON.stringify(field)}`);
  }
  const format = field.format as CnabFieldFormat;
  const date = asNumberStringDate(field.value, format.dateFormat);
  if (field.format) {
    field.format.value = date;
  } else {
    field.format = {
      formatType: 'Date',
      value: date,
    }
  }
}

/**
 * If no format defined, set format as number
 */
export function parseNumber(field: CnabField) {
  if (field?.format && field?.format?.formatType !== 'number') {
    throw new Error(`Expected CnabFieldAs<number> with formatType = 'number'. ${JSON.stringify(field)}`);
  }
  const { decimal } = getPictureNumberSize(field.picture);
  const num = Number(field.value) / (decimal ? (10 * decimal) : 1);
  if (field.format) {
    field.format.value = num;
  } else {
    field.format = {
      formatType: 'number',
      value: num
    };
  }
}

/**
 * If no format defined, set format as string
 */
export function parseText(field: CnabField) {
  if (field.format && field.format?.formatType !== 'string' && !field.format.force) {
    throw new Error(`Expected CnabFieldAs<string> with formatType = 'string'. ${JSON.stringify(field)}`);
  }
  const str = String(field.value).trim();
  if (field.format) {
    field.format.value = str;
  } else {
    field.format = {
      formatType: 'string',
      value: str,
    }
  }
}

/**
 * Remember:
 * - CnabField position start starts counting from 1, not zero.
 * - To represent size = 1 the position must be [1,1], [8,8] etc.
 * - To represent size = 2 the position must be [1,2], [8,9] etc.
 */
export function getCnabFieldFromString(
  cnabStringLine: string,
  fieldDTO: CnabField,
): CnabField {
  const field = structuredClone(fieldDTO);
  const start = fieldDTO.pos[0] - 1;
  const end = fieldDTO.pos[1];
  field.value = cnabStringLine.slice(start, end);
  return field;
}

/**
 * Remember:
 * - CnabField position start starts counting from 1, not zero.
 * - To represent size = 1 the position must be [1,1], [8,8] etc.
 * - To represent size = 2 the position must be [1,2], [8,9] etc.
 */
export function validateParseCnabField(
  field: CnabField,
) {
  validateCnabField(field);
  validateCnabFieldValue(field);
}

/**
 * Check if CnabField value has expected formatting
 * 
 * Example: number, date, text
 */
export function validateCnabFieldValue(field: CnabField) {
  getStringFromCnabField(field);

  // #endregion
}

export function getNumberFromCnabField(field: CnabField): number {
  const { decimal } = getPictureNumberSize(field.picture);
  if (typeof field.value === 'string') {
    const num = asStringNumber(field.value);
    if (field.value.includes('.')) {
      return num;
    } else {
      return Number(num.toFixed(decimal));
    }
  } else {
    return asNumber(field.value);
  }
}

export function cnabFieldToString(field: CnabField): string {
  return JSON.stringify({
    ...field,
    dateFormat: field?.format?.dateFormat || 'undefined',
  });
}

export function setCnabFieldMetadata(
  field: CnabField,
  fieldName: string,
  registroName: string,
  loteNumber?: number,
  cnabName?: string,
) {
  field._metadata = {
    name: fieldName,
    registro: registroName,
    registroIndex: loteNumber,
    cnab: cnabName,
  };
}
