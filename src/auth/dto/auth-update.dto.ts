import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsOptional, Length } from 'class-validator';
import { IsPhoneBr } from '../validators/is-phone-br.validator';
import { IsNotNumberString } from 'src/utils/validators/is-not-number-string.validator';
import { IsValidBankCode } from '../validators/is-valid-bank-code.validator';

export class AuthUpdateDto {
  @ApiProperty({ example: '001' })
  @IsOptional()
  @IsNumberString()
  @Length(3, 3)
  @IsValidBankCode()
  bankCode?: string;

  @ApiProperty({ example: '1234' })
  @IsOptional()
  @Length(4, 4)
  @IsNumberString()
  bankAgency?: string;

  @ApiProperty({ example: '17263731' })
  @IsOptional()
  @IsNumberString()
  @Length(5, 20)
  bankAccount?: string;

  @ApiProperty({ example: '2' })
  @IsOptional()
  @IsNumberString()
  @Length(1, 2)
  bankAccountDigit?: string;

  @ApiProperty({ example: '(21)91234-5678' })
  @IsOptional()
  @IsNotNumberString()
  @IsPhoneBr({ countryCode: false, stateCode: true, mobileDigit: 'optional' })
  phone?: string;
}
