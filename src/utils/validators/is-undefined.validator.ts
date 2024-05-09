import {
  ValidateBy,
  ValidationOptions,
  ValidationTypes,
  buildMessage,
} from 'class-validator';

// isUndefined is a special case
export const IS_DEFINED = ValidationTypes.IS_DEFINED;
/**
 * Checks if value is undefined.
 */
export function isUndefined(value: any) {
  return value === undefined;
}
/**
 * Checks if value is undefined.
 */
export function IsUndefined(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: IS_DEFINED,
      validator: {
        validate: (value: any) => isUndefined(value),
        defaultMessage: buildMessage(
          (eachPrefix: any) => eachPrefix + '$property should be undefined',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
