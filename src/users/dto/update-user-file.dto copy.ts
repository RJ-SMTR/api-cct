import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';
import { stringTransformer } from 'src/utils/transformers/string.transformer copy';
import { IsCpfCnpj } from 'src/utils/validators/is-cpf-cnpj.validator';
import { IsPhoneBr } from 'src/utils/validators/is-phone-br.validator';

export class UpdateUserFileDto {
  /**
   * User file: `email`
   */
  @ApiProperty({ example: 'test1@example.com' })
  @Optional()
  @Transform(lowerCaseTransformer)
  codigo_permissionario?: string;

  /**
   * User field: `permitCode`
   */
  @ApiProperty({ example: '213890329890312' })
  @Optional()
  @IsNotEmpty()
  nome?: string;

  /**
   * User field: `fullName`
   */
  @ApiProperty({ example: 'Henrique Santos Template' })
  @IsString()
  @IsNotEmpty()
  email?: string;

  /**
   * User field: `phone`
   */
  @ApiProperty({ example: '21912345678' })
  @Optional()
  @Transform(stringTransformer)
  @IsPhoneBr({
    countryCode: false,
    mobileDigit: true,
    stateCode: true,
    numeric: true,
  })
  telefone?: string;

  /**
   * User field: `cpfCnpj`
   */
  @ApiProperty({ example: '1234567890' })
  @Optional()
  @Transform(stringTransformer)
  @IsCpfCnpj({ isCpf: true, isCnpj: false, numeric: true })
  cpf?: string;
}
