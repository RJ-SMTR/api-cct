import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { SettingTypeEnum } from '../setting-type.enum';
import { Enum } from 'src/utils/enum';

@Entity({ name: 'setting_type' })
export class SettingType extends BaseEntity {
  constructor(setting?: SettingTypeEnum) {
    super();
    if (setting) {
      this.id = setting;
      this.name = Enum.getKey(SettingTypeEnum, setting);
    }
  }
  @Exclude()
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_SettingType_id' })
  id: number;

  @ApiProperty({ example: 'boolean' })
  @Column({ unique: true })
  name: string;
}
