import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';
import { isArrayUnique } from '../array-utils';

export const IS_NUMBER_STRING = 'isNumberString';

export interface MatchesListOptions {
  /** List to compare with */
  list?: any[];
  itemCallback?: (i: string) => boolean;
  /** If must have unique values */
  unique?: boolean;
}

/**
 * Checks if the string is non numeric.
 * If given value is not a string, it also returns false.
 *
 * Forked from {@link https://github.com/typestack/class-validator/blob/4639f93b9a95d04376b183bcbc0d14c42889c424/src/decorator/string/IsNumberString.ts IsNumberString.ts - class-validator}
 */
export function matchesList(
  value: unknown,
  options: MatchesListOptions,
): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const valueList = value.split(',');

  const list = options.list;
  if (list) {
    const isInList = valueList.every((i) => list.includes(i));
    const isUnique = !options?.unique || isArrayUnique(list);
    if (!isInList || !isUnique) {
      return false;
    }
  }

  const isItemValid = options.itemCallback;
  if (isItemValid) {
    if (!list?.every(isItemValid)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if is number list
 *
 * @example 10,11,359
 *
 * If given value is not a string, it also returns false.
 */
export function MatchesList(
  options?: MatchesListOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_NUMBER_STRING,
      constraints: [options],
      validator: {
        validate: (value, args): boolean =>
          matchesList(value, args?.constraints[0]),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix +
            `$property must be a ${
              options?.unique ? 'unique' : ''
            } list with valid content`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
