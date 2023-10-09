// decorators/validate-type.decorator.ts
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

interface IsMatchingTypeOptions {
  refTable: string | object;
  fkField: string;
}

@ValidatorConstraint({ async: false })
export class IsMatchingTypeConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async validate(value: any, args: ValidationArguments) {
    const { refTable, fkField } = args.constraints[0];
    const entity = await this.dataSource
      .getRepository(refTable)
      .findOne({ where: { id: args.object[fkField] } });
    if (!entity) {
      console.log('ENTIT NOT FOUND');
      return false;
    }
    const expectedType = entity?.['name'];
    return (
      (expectedType === 'boolean' &&
        ['true', 'false'].includes(value.toLowerCase())) ||
      (expectedType === 'number' && !isNaN(Number(value))) ||
      expectedType === 'string'
    );
  }

  defaultMessage() {
    return `invalidType`;
  }
}

export function IsMatchingType(
  options: IsMatchingTypeOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMatchingType',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsMatchingTypeConstraint,
    });
  };
}
