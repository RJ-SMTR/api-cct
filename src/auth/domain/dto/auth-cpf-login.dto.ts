import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

const normalizeCpfTransformer = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class AuthCpfLoginDto {
  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @Transform(normalizeCpfTransformer)
  cpf: string;

  @ApiProperty({ example: 'secret' })
  @IsNotEmpty()
  password: string;
}
