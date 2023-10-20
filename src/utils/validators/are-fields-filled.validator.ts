import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  isEmpty,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class AreFieldsFilledConstraint implements ValidatorConstraintInterface {
  private getStringArray2D(arrayNd: string[] | string[][]): string[][] {
    return typeof arrayNd[0] === 'string'
      ? [arrayNd as string[]]
      : (arrayNd as string[][]);
  }

  validate(value: any, args: ValidationArguments) {
    const fieldsObject = args.object;
    if (args.constraints.length === 0) {
      return true;
    }
    const fieldNames = this.getStringArray2D(args.constraints);

    let areAnyFieldsGroupFilled = false;
    for (const fields of fieldNames) {
      let areFieldsGroupFilled = true;
      for (const field of fields) {
        const fieldExists = fieldsObject.hasOwnProperty(field);
        const fieldValue = fieldsObject?.[field];
        if (!fieldExists || isEmpty(fieldValue)) {
          areFieldsGroupFilled = false;
        }
      }
      if (areFieldsGroupFilled) {
        areAnyFieldsGroupFilled = true;
      }
    }
    return areAnyFieldsGroupFilled;
  }

  defaultMessage(args: ValidationArguments) {
    return `The fields (${args.constraints.join(') OR (')}) must be filled.`;
  }
}

/**
 * @param fields
 *  if `string[]` it will check if all fields are filled
 *  if `string[][]` it will check if act as OR operator for each `stirng[]` item
 */
export function AreFieldsFilled(
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
      validator: AreFieldsFilledConstraint,
    });
  };
}
