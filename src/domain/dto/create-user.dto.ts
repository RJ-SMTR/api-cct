import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../security/roles/entities/role.entity';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
  Validate,
} from 'class-validator';
import { Status } from 'src/domain/entity/status.entity';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { FileEntity } from 'src/domain/entity/file.entity';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'test1@example.com' })
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyExists',
  })
  @IsEmail()
  email: string | null;

  @ApiProperty()
  @MinLength(6)
  password?: string;

  provider?: string;

  socialId?: string | null;

  @ApiProperty({ example: 'John' })
  firstName?: string | null;

  @ApiProperty({ example: 'Doe' })
  lastName?: string | null;

  @ApiProperty({ example: 'John Doe' })
  fullName?: string | null;

  @ApiProperty({ type: () => FileEntity })
  @IsOptional()
  @Validate(IsExist, ['FileEntity', 'id'], {
    message: 'imageNotExists',
  })
  photo?: FileEntity | null;

  @ApiProperty({ type: Role })
  @Validate(IsExist, ['Role', 'id'], {
    message: 'roleNotExists',
  })
  role?: Role | null;

  @ApiProperty({ type: Status })
  @Validate(IsExist, ['Status', 'id'], {
    message: 'statusNotExists',
  })
  status?: Status;

  hash?: string | null;

  @ApiProperty({ example: '213890329890312' })
  @Validate(IsNotExist, ['User'], {
    message: 'licenseeAlreadyExists',
  })
  permitCode?: string;

  @ApiProperty({ example: '16322676313' })
  cpfCnpj?: string;

  @ApiProperty({ example: 1 })
  bankCode?: number;

  @ApiProperty({ example: '6352' })
  bankAgency?: string;

  @ApiProperty({ example: '17263731' })
  bankAccount?: string;

  @ApiProperty({ example: '2' })
  bankAccountDigit?: string;

  @ApiProperty({ example: '(21)91234-5678' })
  phone?: string;

  @ApiProperty()
  isSgtuBlocked?: boolean;

  @ApiProperty({ example: '19003842273' })
  passValidatorId?: string;
}
