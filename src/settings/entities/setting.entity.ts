import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { SettingType } from 'src/setting-types/entities/setting-type.entity';

@Entity({ name: 'setting' })
@Unique(['name', 'version'])
export class SettingEntity extends BaseEntity {
  @Exclude()
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @ApiProperty({ example: 'activate_auto_send_invite' })
  @Column()
  name: string;

  @ApiProperty({ example: 'true' })
  @Column()
  value: string;

  @ApiProperty({ example: '1' })
  @Column({ type: String, nullable: true })
  version: string | null;

  @ApiProperty({ example: false })
  @Column()
  editable: boolean;

  @ApiProperty({ examples: ['boolean', 'string', 'number'] })
  @ManyToOne(() => SettingType, {
    eager: true,
  })
  settingType: SettingType;
}
