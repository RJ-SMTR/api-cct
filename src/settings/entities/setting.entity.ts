import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { SettingType } from 'src/setting-types/entities/setting-type.entity';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { ISettingData } from '../interfaces/setting-data.interface';

@Entity({ name: 'setting' })
@Unique('UQ_Setting_name_version', ['name', 'version'])
export class SettingEntity extends BaseEntity {
  constructor(data?: ISettingData) {
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
  @PrimaryColumn({ insert: true, primaryKeyConstraintName: 'PK_Setting_id' })
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
  @JoinColumn({ foreignKeyConstraintName: 'FK_Setting_settingType_ManyToOne' })
  settingType: SettingType;

  getValueAsNullableJson(): any | null {
    if (!this.value) {
      return null;
    } else
      try {
        return JSON.parse(this.value);
      } catch (error) {
        throw new HttpException(
          {
            error: HttpStatusMessage.INTERNAL_SERVER_ERROR,
            details: {
              value: `should be valid JSON, received '${this.value}' instead`,
            },
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
  }

  getValueAsJson(): any {
    const value = this.getValueAsNullableJson();
    if (value !== null) {
      return value;
    } else {
      throw new HttpException(
        {
          error: HttpStatusMessage.INTERNAL_SERVER_ERROR,
          details: {
            value: 'should not be null',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getValueAsNullableBoolean(): boolean | null {
    if (!this?.value) {
      return null;
    } else if (this.value === 'true') {
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
          error: HttpStatusMessage.INTERNAL_SERVER_ERROR,
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
          error: HttpStatusMessage.INTERNAL_SERVER_ERROR,
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
