import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNumberString, IsOptional, MaxLength, MinLength, Validate } from 'class-validator';
import { FileEntity } from 'src/files/entities/file.entity';
import { Status } from 'src/statuses/entities/status.entity';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { Role } from '../../roles/entities/role.entity';

/**
 * `permitCode` não herda a validação de unicidade (`IsNotExist`) do CreateUserDto: o body
 * não tem `id`, então ela barrava o próprio dono do código (#1356). A unicidade é validada
 * no repository (UpdateUserRepositoryDto, com `id`, e o histórico de códigos).
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['permitCode'] as const)) {
  @ApiProperty({ example: '213890329890312' })
  @IsOptional()
  permitCode?: string;

  @ApiProperty({ example: 'test1@example.com' })
  @Transform(lowerCaseTransformer)
  @IsEmail()
  email?: string | null;

  @ApiProperty()
  @IsOptional()
  @MinLength(6)
  password?: string;

  provider?: string;

  socialId?: string | null;

  @ApiProperty({ example: 'John' })
  @IsOptional()
  firstName?: string | null;

  @ApiProperty({ example: 'Doe' })
  @IsOptional()
  lastName?: string | null;

  @ApiProperty({ type: () => FileEntity })
  @IsOptional()
  @Validate(IsExist, ['FileEntity', 'id'], {
    message: 'imageNotExists',
  })
  photo?: FileEntity | null;

  @ApiProperty({ type: Role })
  @IsOptional()
  @Validate(IsExist, ['Role', 'id'], {
    message: 'roleNotExists',
  })
  role?: Role | null;

  @ApiProperty({ type: Status })
  @IsOptional()
  @Validate(IsExist, ['Status', 'id'], {
    message: 'statusNotExists',
  })
  status?: Status;

  hash?: string | null;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsNumberString()
  @MaxLength(5)
  bankAgency?: string | undefined;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsNumberString()
  @MaxLength(12)
  bankAccount?: string | undefined;

  @ApiProperty({ type: String })
  @IsOptional()
  @IsNumberString()
  @MaxLength(1)
  bankAccountDigit?: string | undefined;

  @ApiProperty({ type: String, enum: ['corrente', 'poupanca'] })
  @IsOptional()
  @IsIn(['corrente', 'poupanca'])
  bankAccountType?: string | undefined;
}
