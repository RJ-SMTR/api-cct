import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { Injectable } from '@nestjs/common';

@Injectable()
@ValidatorConstraint({ name: 'IsExist', async: true })
export class IsExist implements ValidatorConstraintInterface {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async validate(value: string, validationArguments: ValidationArguments) {
    const repository = validationArguments.constraints[0];
    const properties: undefined | string | Array<string | object> =
      validationArguments.constraints[1];
    const where = new Object();
    if (properties === undefined) {
      where[validationArguments.property] = value;
    } else if (typeof properties === 'string') {
      const prop = properties;
      where[prop] = value?.[prop];
    } else if (
      Object.prototype.toString.call(properties) === '[object Array]'
    ) {
      for (const prop of properties) {
        if (typeof prop === 'string') {
          where[prop] = validationArguments.object[prop];
        } else {
          for (const key in prop) {
            where[key] = prop[key];
          }
        }
      }
    }
    const entity: unknown = await this.dataSource
      .getRepository(repository)
      .findOne({ where: where });
    return Boolean(entity);
  }
}
