import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { InviteService } from '../invite.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@ValidatorConstraint({ async: false })
export class InviteHashExistsConstraint
  implements ValidatorConstraintInterface
{
  constructor(private readonly inviteService: InviteService) {}

  validate(value: any) {
    const inviteFound = this.inviteService.findByHash(value);
    return Boolean(inviteFound);
  }
  defaultMessage() {
    return 'invalidInviteHash';
  }
}

export function InviteHashExists(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: InviteHashExistsConstraint,
    });
  };
}
