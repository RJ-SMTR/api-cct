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
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { SettingDataInterface } from '../interfaces/setting-data.interface';

@Entity({ name: 'setting' })
@Unique(['name', 'version'])
export class SettingEntity extends BaseEntity {
  constructor(data?: SettingDataInterface) {
    super();
    if (data) {
      this.name = data.name;
      this.value = data.value;
      this.version = data.version;
      this.settingType = new SettingType(data.settingType);
      this.editable = data.editable;
    }
  }
  @Exclude()
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ insert: true })
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

  getValueAsNullableBoolean(): boolean | null {
    if (!this?.value) {
      return null;
    }
    if (this.value === 'true') {
      return true;
    } else if (this.value === 'false') {
      return false;
    } else {
      return null;
    }
  }

  getValueAsBoolean(): boolean {
    const value = this.getValueAsNullableBoolean();
    if (value !== null) {
      return value;
    } else {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            value: 'should not be null',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getValueAsString(): string {
    if (!this?.value) {
      throw new HttpException(
        {
          error: HttpErrorMessages.INTERNAL_SERVER_ERROR,
          details: {
            value: 'should not be null',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      return this.value;
    }
  }
}
