import { ValidationCodeDestinationEnum } from 'src/validation-code/validation-code-destination/validation-code-destination.enum';
import { ValidationCodeMethodEnum } from 'src/validation-code/validation-code-method/validation-code-method.enum';
import { NoRecentValidationCodes } from 'src/validation-code/validators/max-recent-validation-codes.validator';
import { User } from 'src/users/entities/user.entity';
import { IsEquals } from 'src/utils/validators/is-equals.validator';

interface DtoInterface {
  user: User | null;
}

export class AuthWhatsappBaseDataDto {
  @NoRecentValidationCodes({
    methods: [ValidationCodeMethodEnum.whatsapp, ValidationCodeMethodEnum.sms],
    destinations: [ValidationCodeDestinationEnum.phone],
    maxOccurrences: 3,
    maxMinutesAgo: 5,
  })
  @IsEquals(false, User, 'isPhoneValidated', {
    message: 'phoneAlreadyValidated',
  })
  user: User | null;

  constructor(data: DtoInterface) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
