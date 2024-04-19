import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { DataSource } from 'typeorm';

/**
 * @description Validate if field is unique (if does not exists in item with different id).
 *
 * To check if existing item is itself or not the DTO must have 'id' column.
 *
 * Usage example:
 * ```typescript
 * \@Validate(IsNotExist, ['User', {
 *    ignoreBlankOrNull: true, // optional
 *    idColumn: 'id', // optional
 * }], {
 *     message: 'emailAlreadyExists',
 *   })
 *   ```
 */
@Injectable()
@ValidatorConstraint({ name: 'IsNotExist', async: true })
export class IsNotExist implements ValidatorConstraintInterface {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async validate(value: string, validationArguments: ValidationArguments) {
    const repository = validationArguments.constraints[0] as string;
    const args = validationArguments.constraints[1] as any;
    const ignoreBlankOrNull = args?.ignoreBlankOrNull;
    const idColumn = args?.idColumn || 'id';
    const currentValue = validationArguments.object as any;
    const entity = await this.dataSource.getRepository(repository).findOne({
      where: {
        [validationArguments.property]: value,
      },
    });

    if (entity?.[idColumn] === currentValue?.id || ignoreBlankOrNull === true) {
      return true;
    }

    return !entity;
  }
}
