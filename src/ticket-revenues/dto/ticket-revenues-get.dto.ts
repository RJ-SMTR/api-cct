import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';
import { AreFieldsEmpty } from 'src/utils/validators/are-fields-empty.validator';
import { TicketRevenuesGroupByEnum } from '../enums/ticket-revenues-group-by.enum';

export class TicketRevenuesGetDto {
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

  @ApiProperty({
    example: WeekdayEnum._4_THURSDAY,
    default: WeekdayEnum._4_THURSDAY,
  })
  @IsOptional()
  startWeekday: number;

  @ApiProperty({
    example: WeekdayEnum._4_THURSDAY,
    default: true,
    description: 'ignore incomplete previous week in `startDate`',
  })
  @IsOptional()
  ignorePreviousWeek: boolean;

  @ApiProperty({
    examples: TicketRevenuesGroupByEnum,
    default: TicketRevenuesGroupByEnum.DAY,
    required: false,
  })
  @IsOptional()
  groupBy?: TicketRevenuesGroupByEnum;
}
