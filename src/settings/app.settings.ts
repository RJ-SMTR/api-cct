import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { SettingDataInterface } from './interfaces/setting-data.interface';
import { CronExpression } from '@nestjs/schedule';

/**
 * Helper for default settings
 * @_type SettingsRecordType
 */
export const appSettings = {
  // any version

  any__activate_auto_send_invite: {
    name: 'activate_auto_send_invite',
    value: 'false',
    version: null,
    editable: true,
    settingType: SettingTypeEnum.boolean,
  } as SettingDataInterface,

  /** Hours in UTC */
  any__auto_send_invite_schedule_hours: {
    name: 'auto_send_invite_schedule_hours',
    value: '25',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as SettingDataInterface,

  any__poll_db_enabled: {
    name: 'poll_db_enabled',
    value: 'true',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as SettingDataInterface,

  any__poll_db_cronjob: {
    name: 'poll_db_cronjob',
    value: CronExpression.EVERY_MINUTE,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as SettingDataInterface,

  any__mail_invite_cronjob: {
    name: 'mail_invite_cronjob',
    value: CronExpression.EVERY_DAY_AT_10PM,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as SettingDataInterface,

  any__mail_report_cronjob: {
    name: 'mail_report_cronjob',
    value: CronExpression.EVERY_DAY_AT_3AM,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as SettingDataInterface,

  // v1

  v1__ab_test_enabled: {
    name: 'ab_test_enabled',
    value: 'false',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as SettingDataInterface,
  v1__user_file_max_upload_size: {
    name: 'user_file_max_upload_size',
    value: '10MB',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.string,
  } as SettingDataInterface,
};
