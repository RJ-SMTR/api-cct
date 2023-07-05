import {
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { Injectable } from '@nestjs/common';

@Injectable()
@ValidatorConstraint({ name: 'IsEquals', async: true })
export class IsEqualsConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async validate(value: string, validationArguments: ValidationArguments) {
    const expectedValue = validationArguments.constraints[0];
    const repository = validationArguments.constraints[1];
    const pathToProperty = validationArguments.constraints[2];
    const entity: unknown = await this.dataSource
      .getRepository(repository)
      .findOne({
        where: {
          [pathToProperty ? pathToProperty : validationArguments.property]:
            pathToProperty ? value?.[pathToProperty] : value,
        },
      });

    return Boolean(
      entity &&
        entity[
          pathToProperty ? pathToProperty : validationArguments.property
        ] === expectedValue,
    );
  }

  defaultMessage() {
    return 'invalidValue';
  }
}

export function IsEquals(
  expectedValue: any,
  repository: any,
  pathToProperty?: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'equalsTo',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [expectedValue, repository, pathToProperty],
      validator: IsEqualsConstraint,
    });
  };
}
