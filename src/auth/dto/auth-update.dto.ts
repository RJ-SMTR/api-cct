import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsOptional, Length, Max, Min } from 'class-validator';
import { IsPhoneBr } from '../../utils/validators/is-phone-br.validator';
import { IsNotNumberString } from 'src/utils/validators/is-not-number-string.validator';
import { IsValidBankCode } from '../../banks/validators/is-valid-bank-code.validator';

export class AuthUpdateDto {
  @ApiProperty({ example: 1 })
  @IsOptional()
  @Min(0)
  @Max(999)
  @IsValidBankCode()
  bankCode?: number;

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
