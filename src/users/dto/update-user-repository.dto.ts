import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsOptional,
  MinLength,
  Validate,
} from 'class-validator';
import { FileEntity } from 'src/files/entities/file.entity';
import { Status } from 'src/statuses/entities/status.entity';
import { lowerCaseTransformer } from 'src/utils/transformers/lower-case.transformer';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { IsUndefined } from 'src/utils/validators/is-undefined.validator';
import { Role } from '../../roles/entities/role.entity';

export class UpdateUserRepositoryDto extends PartialType(CreateUserDto) {
  /** id of user to update, so this DTO can validate */
  @IsDefined()
  id: number;

  /**
   * If email is valid email and unique.
   */
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @Validate(IsNotExist, ['User'], {
    message: 'emailAlreadyExists',
  })
  email?: string | null;

  @IsOptional()
  @MinLength(6)
  @Transform(lowerCaseTransformer)
  password?: string;

  provider?: string;

  socialId?: string | null;

  @IsOptional()
  firstName?: string | null;

  @IsOptional()
  lastName?: string | null;

  photo?: FileEntity | null;

  @ApiProperty({ type: Role })
  @IsOptional()
  @Validate(IsExist, ['Role', 'id'], {
    message: 'roleNotExists',
  })
  role?: Role | null;

  status?: Status;

  hash?: string | null;

  /** The system does not allow update cpfCnpj */
  @IsUndefined()
  cpfCnpj?: undefined;
}
