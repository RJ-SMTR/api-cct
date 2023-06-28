import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsCpfCnpj } from '../validators/is-cpf-cnpj.validator';

export class AuthPreRegisterLicenseeDto {
  @ApiProperty({ example: 'P1234' })
  @IsNotEmpty()
  licensee: string;

  @ApiProperty({ example: '79858972679' })
  @IsNotEmpty()
  @IsCpfCnpj()
  cpfCnpj: string;
}
