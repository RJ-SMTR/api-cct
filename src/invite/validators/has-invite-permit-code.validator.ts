import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InviteService } from '../invite.service';

@Injectable()
@ValidatorConstraint({ async: false })
export class HasInvitePermitCodeConstraint
  implements ValidatorConstraintInterface
{
  constructor(private readonly inviteService: InviteService) {}

  validate(value: string, args: ValidationArguments) {
    const dtoFields = args.object;
    const { hashField } = args.constraints[0];
    const hash = dtoFields[hashField];

    const inviteFoundByHash = this.inviteService.findByHash(hash);

    if (!inviteFoundByHash) {
      return true;
    }

    return inviteFoundByHash.permitCode === value;
  }

  defaultMessage() {
    return 'invalidPermitCode';
  }
}

export function HasInvitePermitCode(
  hashField = 'hash',
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [{ hashField }],
      validator: HasInvitePermitCodeConstraint,
    });
  };
}
