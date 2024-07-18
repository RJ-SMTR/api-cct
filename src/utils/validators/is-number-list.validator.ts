import isNumericValidator from 'validator/lib/isNumeric';
import ValidatorJS from 'validator';
import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

export const IS_NUMBER_STRING = 'isNumberString';

export interface IsNumberListOptions {
  /**
   * If `no_symbols` is true, the validator will reject numeric strings that feature a symbol (e.g. `+`, `-`, or `.`).
   *
   * @default false
   */
  no_symbols?: boolean;
  format?: 'decimal' | 'integer';
  min?: number;
  max?: number;
}

/**
 * Checks if the string is non numeric.
 * If given value is not a string, it also returns false.
 *
 * Forked from {@link https://github.com/typestack/class-validator/blob/4639f93b9a95d04376b183bcbc0d14c42889c424/src/decorator/string/IsNumberString.ts IsNumberString.ts - class-validator}
 */
export function isNumberList(
  value: unknown,
  options?: IsNumberListOptions,
): boolean {
  const isMin = (i: number) => options?.min === undefined || +i >= options.min;
  const isMax = (i: number) => options?.max === undefined || +i <= options.max;
  const isFormat = (v: number) =>
    !options?.format || options.format === 'decimal' ? v % 1 != 0 : v % 1 == 0;
  return (
    typeof value === 'string' &&
    value
      .split(',')
      .every(
        (i) =>
          isNumericValidator(i, { no_symbols: options?.no_symbols }) &&
          isMin(+i) &&
          isMax(+i) &&
          isFormat(+i),
      )
  );
}

/**
 * Checks if is number list
 *
 * @example 10,11,359
 *
 * If given value is not a string, it also returns false.
 */
export function IsNumberList(
  options?: IsNumberListOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_NUMBER_STRING,
      constraints: [options],
      validator: {
        validate: (value, args): boolean =>
          isNumberList(value, args?.constraints[0]),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be number list',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
