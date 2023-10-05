import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, Validate } from 'class-validator';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { SettingEntity } from '../entities/setting.entity';
import { IsMatchingType } from 'src/utils/validators/is-matching-type.validator';

export class UpdateSettingsDto {
  @ApiProperty({ example: 'activate_auto_send_invite' })
  // @IsNotEmpty()
  @Validate(IsExist, [SettingEntity, ['name', 'version', { editable: true }]], {
    message: 'settingNotExists',
  })
  name: string;

  @ApiProperty({ examples: [null, '1'], default: null })
  @IsOptional()
  version: string | null;

  @ApiProperty({ example: 'true' })
  @IsNotEmpty()
  @IsMatchingType({ refTable: 'setting_type', fkField: 'settingType' })
  value: string;
}
