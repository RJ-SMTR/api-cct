import { User } from 'src/users/entities/user.entity';
import { ValidationCodeDestinationEnum } from '../validation-code-destination/validation-code-destination.enum';
import { ValidationCodeDestination } from '../validation-code-destination/entities/validation-code-destination.entity';
import { ValidationCodeMethodEnum } from '../validation-code-method/validation-code-method.enum';
import { ValidationCodeMethod } from '../validation-code-method/entities/validation-code-method.entity';

export interface BaseValidationCodeInterface {
  user: User;
  destination: ValidationCodeDestination | ValidationCodeDestinationEnum;
  method: ValidationCodeMethod | ValidationCodeMethodEnum;
  expiresAt?: Date | null;
}
