import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import {
  DASHBOARD_DATE_TYPES,
  DEFAULT_DASHBOARD_DATE_TYPE,
} from '../agentes-dashboard-date-type';

export class AgentesDashboardQueryDto {
  @ApiProperty({ example: '2026-05' })
  @Matches(/^\d{4}-\d{2}$/)
  month: string;

  @ApiPropertyOptional({ example: '2026-05-20' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: '2026-05-21' })
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @ApiPropertyOptional({
    enum: DASHBOARD_DATE_TYPES,
    default: DEFAULT_DASHBOARD_DATE_TYPE,
  })
  @IsOptional()
  @IsIn(DASHBOARD_DATE_TYPES)
  dateType?: 'tentative' | 'effective';

  @ApiPropertyOptional({ example: 123 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  userId?: number;
}
