import { ValidationOptions } from 'class-validator';

export interface CustomValidationOptions extends ValidationOptions {
  details?: string | object;
}

export function setCustomValidationOptions(
  validationOptions: CustomValidationOptions,
): ValidationOptions {
  return {
    ...validationOptions,
    message:
      validationOptions?.details &&
      JSON.stringify({
        error: validationOptions.message,
        details: validationOptions.details,
      }),
  };
}
