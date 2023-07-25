// not-both-filled.decorator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  isEmpty,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class AreFieldsEmptyConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    console.log('VALIDATE', args.object, Object(args.object));

    const fieldsObject = args.object;
    const fieldNames: string[] = args.constraints;
    if (isEmpty(value) || fieldNames.length === 0) {
      return true;
    }

    for (const i in fieldNames) {
      const field = fieldNames[i];
      const fieldExists = fieldsObject.hasOwnProperty(field);
      const fieldValue = fieldsObject?.[field];
      if (fieldExists && !isEmpty(fieldValue)) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be empty if any of these fields (${args.constraints}) are filled.`;
  }
}

export function AreFieldsEmpty(
  fields: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'notBothFilled',
      target: object.constructor,
      propertyName: propertyName,
      constraints: fields,
      options: validationOptions,
      validator: AreFieldsEmptyConstraint,
    });
  };
}
