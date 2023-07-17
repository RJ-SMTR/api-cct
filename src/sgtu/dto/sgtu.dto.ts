import { IsNotEmpty, Validate } from 'class-validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

export class SgtuDto {
  id?: string;

  fullName: string;

  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'licenseeAlreadyRegistered',
  })
  cpfCnpj: string;

  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'permitCodeAlreadyRegistered',
  })
  permitCode: string;

  isSgtuBlocked: boolean;

  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyRegistered',
  })
  email: string;

  rg?: string;

  plate?: string;

  phone?: string;
}
