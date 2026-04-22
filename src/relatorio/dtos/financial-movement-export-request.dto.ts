import { OmitType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FinancialMovementQueryDto } from './pay-and-pending-query.dto';

export enum FinancialMovementExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export class FinancialMovementExportRequestDto extends OmitType(
  FinancialMovementQueryDto,
  ['page', 'pageSize', 'cursorDataReferencia', 'cursorNome', 'cursorStatus', 'cursorCpfCnpj'] as const,
) {
  @ApiProperty({
    enum: FinancialMovementExportFormat,
    description: 'Formato de saída do relatório',
    example: FinancialMovementExportFormat.CSV,
  })
  @IsEnum(FinancialMovementExportFormat)
  format: FinancialMovementExportFormat;
}
