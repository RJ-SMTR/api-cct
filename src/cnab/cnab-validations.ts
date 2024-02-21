import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { isStringBasicAlnumUpper } from 'src/utils/string-utils';
import { CNAB_SUPPORTED_FORMATS } from './cnab-consts';
import {
  getCnabFieldType,
  getPictureNumberSize,
  getPictureTextSize,
} from './cnab-utils';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';

/**
 * Validates if current item position matches position of previous item.
 */
export function validateRegistroPosition(
  current: CnabField,
  previous: CnabField | undefined,
  hasNext: boolean,
) {
  if (!previous && current.pos[0] !== 1) {
    throw new Error(
      `First CnabField position start should be 0 but is ${current.pos[0]}`,
    );
  }
  if (!hasNext && !CNAB_SUPPORTED_FORMATS.includes(current.pos[1])) {
    throw new Error(
      'Last CnabField position end should be one of these values' +
        `${CNAB_SUPPORTED_FORMATS} but is ${current.pos[1]}`,
    );
  } else if (previous && current.pos[0] !== previous?.pos[1] + 1) {
    throw new Error(
      'Current start and previous end item positions' +
        `should be both ${current.pos[0]} but are: previousEnd: ` +
        `${previous.pos[1]}, currentStart: ${current.pos[0]}`,
    );
  }
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
    throw CommonHttpException.detailField(
      'error',
      `CnabField value "${item.value}" formatting has invalid Text format.`,
    );
  }
  return isCnabTextValid;
}
