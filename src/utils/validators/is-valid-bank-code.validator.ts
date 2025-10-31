import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Bank } from '../../domain/entity/bank.entity';

@Injectable()
@ValidatorConstraint({ async: true })
export class IsValidBankCodeConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async validate(value: number) {
    const banksRepository: Repository<Bank> =
      this.dataSource.getRepository(Bank);
    const filteredData = await banksRepository.findOne({
      where: { code: value, isAllowed: true },
    });
    if (filteredData) {
      return true;
    } else {
      return false;
    }
  }
  defaultMessage() {
    return 'invalidBankCode';
  }
}

export function IsValidBankCode(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsValidBankCodeConstraint,
    });
  };
}
