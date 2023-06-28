import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../roles/entities/role.entity';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { Status } from 'src/statuses/entities/status.entity';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { FileEntity } from 'src/files/entities/file.entity';
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
  @IsNotEmpty()
  firstName: string | null;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  lastName: string | null;

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

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  fullName?: string;

  @ApiProperty({ example: '213890329890312' })
  @IsNotEmpty()
  permissionCode?: string;

  @ApiProperty({ example: '16322676313' })
  @IsNotEmpty()
  cpf?: string;

  @ApiProperty({ example: '6352' })
  @IsNotEmpty()
  @MaxLength(4)
  agency?: string;

  @ApiProperty({ example: '17263731' })
  @IsNotEmpty()
  bankAccount?: string;

  @ApiProperty({ example: '2' })
  @IsNotEmpty()
  bankAccountDigit?: string;

  @ApiProperty()
  phone?: string;
}
