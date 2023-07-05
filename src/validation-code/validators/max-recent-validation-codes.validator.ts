import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationCodeService } from '../validation-code.service';
import { Equal, In, IsNull, MoreThanOrEqual } from 'typeorm';
import { ValidationCodeMethodEnum } from '../validation-code-method/validation-code-method.enum';
import { ValidationCodeDestinationEnum } from '../validation-code-destination/validation-code-destination.enum';
import { Injectable } from '@nestjs/common';
import { toUTC } from 'src/utils/helpers/to-utc';

interface ValidationOptionsInterface {
  methods?: ValidationCodeMethodEnum[];
  destinations?: ValidationCodeDestinationEnum[];
  maxOccurrences: number;
  maxMinutesAgo: number;
}

@Injectable()
@ValidatorConstraint({ async: true })
export class NoRecentValidationCodesConstraint
  implements ValidatorConstraintInterface
{
  constructor(private validationCodeService: ValidationCodeService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const user = value;
    const {
      methods,
      destinations,
      maxOccurrences,
      maxMinutesAgo,
    }: ValidationOptionsInterface = args.constraints[0];

    const now = new Date();
    const minutesAgo = new Date(now.getTime() - maxMinutesAgo * 60000);

    const recentValidationCodes = await this.validationCodeService.findMany({
      where: {
        createdAt: MoreThanOrEqual(toUTC(minutesAgo)),
        deletedAt: IsNull(),
        ...((methods && { method: In(methods) }) || {}),
        ...((destinations && { destination: In(destinations) }) || {}),
        user: Equal(user.id),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return recentValidationCodes.length < maxOccurrences;
  }

  defaultMessage() {
    return 'tooManyValidationCodes';
  }
}

export function NoRecentValidationCodes(
  args: ValidationOptionsInterface,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [args],
      validator: NoRecentValidationCodesConstraint,
    });
  };
}
