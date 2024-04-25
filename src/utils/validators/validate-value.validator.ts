import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'isCustomValid' })
export class ValidateValueConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const validateCallback: (
      value: any,
      validationOptions?: ValidationOptions,
    ) => boolean = args.constraints[0];
    return validateCallback(value);
  }

  defaultMessage(): string {
    return `Value failed custom validation`;
  }
}

export function ValidateValue(
  validateCallback: (
    value: any,
    validationOptions?: ValidationOptions,
  ) => boolean,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      validator: ValidateValueConstraint,
      options: validationOptions,
      constraints: [validateCallback],
    });
  };
}