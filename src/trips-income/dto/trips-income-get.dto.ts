import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { AreFieldsEmpty } from 'src/utils/validators/are-others-not-filled.validator';

export class TripsIncomeGetDto {
  @ApiProperty({ example: '2023-07-05' })
  @ValidateIf((obj) => obj.endDate && !obj.previousDays)
  @IsNotEmpty({ message: 'startDate and endDate must be both filled or empty' })
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2023-07-10' })
  @ValidateIf((obj) => obj.startDate)
  @IsNotEmpty({ message: 'startDate and endDate must be both filled or empty' })
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    example: 7,
    default: 30,
    description: 'ignored if startDate or endDate are filled.',
  })
  @IsOptional()
  @AreFieldsEmpty(['startDate', 'endDate'])
  @Min(0)
  previousDays?: number;
}
