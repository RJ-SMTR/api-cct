import isNumericValidator from 'validator/lib/isNumeric';
import ValidatorJS from 'validator';
import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

export const IS_NUMBER_STRING = 'isNumberString';

/**
 * Checks if the string is non numeric.
 * If given value is not a string, it also returns false.
 *
 * @forked {@link https://github.com/typestack/class-validator/blob/4639f93b9a95d04376b183bcbc0d14c42889c424/src/decorator/string/IsNumberString.ts IsNumberString.ts - class-validator}
 */
export function isNotNumberString(
  value: unknown,
  options?: ValidatorJS.IsNumericOptions,
): boolean {
  return typeof value === 'string' && !isNumericValidator(value, options);
}

/**
 * Checks if the string is non numeric.
 * If given value is not a string, it also returns false.
 *
 * @forked {@link https://github.com/typestack/class-validator/blob/4639f93b9a95d04376b183bcbc0d14c42889c424/src/decorator/string/IsNumberString.ts IsNumberString.ts - class-validator}
 */
export function IsNotNumberString(
  options?: ValidatorJS.IsNumericOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_NUMBER_STRING,
      constraints: [options],
      validator: {
        validate: (value, args): boolean =>
          isNotNumberString(value, args?.constraints[0]),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a non-numeric string',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
