import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, Validate } from 'class-validator';
import { IsCpfCnpj } from '../validators/is-cpf-cnpj.validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

export class AuthPreRegisterLicenseeDto {
  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'licenseeAlreadyExists',
  })
  licensee: string;

  @ApiProperty({ example: '79858972679' })
  @IsNotEmpty()
  @IsNumberString()
  @IsCpfCnpj()
  cpfCnpj: string;
}
