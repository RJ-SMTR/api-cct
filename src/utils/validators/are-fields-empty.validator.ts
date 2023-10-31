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
  private isStringArray(obj: string[] | string[][]): boolean {
    return typeof obj[0] === 'string';
  }
  validate(value: any, args: ValidationArguments) {
    const fieldsObject = args.object;
    const _fieldNames: string[] | string[][] = args.constraints;
    if (_fieldNames.length === 0) {
      return true;
    }
    const fieldNames: string[][] = this.isStringArray(_fieldNames)
      ? [_fieldNames as string[]]
      : (_fieldNames as string[][]);

    let areAnyFieldsGroupEmpty = false;
    for (const fields of fieldNames) {
      let areFieldsGroupEmpty = true;
      for (const field of fields) {
        const fieldExists = fieldsObject.hasOwnProperty(field);
        const fieldValue = fieldsObject?.[field];
        if (fieldExists && !isEmpty(fieldValue)) {
          areFieldsGroupEmpty = false;
        }
      }
      if (areFieldsGroupEmpty) {
        areAnyFieldsGroupEmpty = true;
      }
    }
    return areAnyFieldsGroupEmpty;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be empty if any of these fields (${args.constraints}) are filled.`;
  }
}

/**
 * @param fields
 *  if `string[]` it will check if all fields are empty
 *  if `string[][]` it will check if act as OR operator for each `stirng[]` item
 */
export function AreFieldsEmpty(
  fields: string[] | string[][],
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
