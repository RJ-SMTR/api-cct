import { CronExpression } from '@nestjs/schedule';
import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { BigqueryEnvironment } from './enums/bigquery-env.enum';
import { ISettingDataGroup } from './interfaces/setting-data-group.interface';
import { ISettingData } from './interfaces/setting-data.interface';

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
  } as ISettingData,

  /** Hours in UTC */
  any__auto_send_invite_schedule_hours: {
    name: 'auto_send_invite_schedule_hours',
    value: '25',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as ISettingData,

  any__poll_db_enabled: {
    name: 'poll_db_enabled',
    value: 'true',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as ISettingData,

  any__poll_db_cronjob: {
    name: 'poll_db_cronjob',
    value: CronExpression.EVERY_MINUTE,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  /** EVERY_DAY_AT_10PM */
  any__mail_invite_cronjob: {
    name: 'mail_invite_cronjob',
    value: CronExpression.EVERY_DAY_AT_10PM,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  /** EVERY_DAY_AT_9AM */
  any__mail_report_cronjob: {
    name: 'mail_report_cronjob',  
    value: CronExpression.EVERY_DAY_AT_9AM,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  any__mail_report_enabled: {
    name: 'mail_report_enabled',
    value: 'false',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as ISettingData,

  any__mail_report_recipient: {
    baseName: 'mail_report_recipient',
    baseVersion: null,
    data: [
      {
        name: 'mail_report_recipient_1',
        value: 'marcosbernardo@hotmail.com',
        version: null,
        editable: false,
        settingType: SettingTypeEnum.string,
      } as ISettingData,
      {
        name: 'mail_report_recipient_2',
        value: 'raphaelrivasbra@gmail.com',
        version: null,
        editable: false,
        settingType: SettingTypeEnum.string,
      } as ISettingData,
    ],
  } as ISettingDataGroup,

  any__bigquery_env: {
    name: 'bigquery_env',
    value: BigqueryEnvironment.Development,
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  any__api_env: {
    name: 'api_env',
    value: 'dev',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  // v1
  v1__ab_test_enabled: {
    name: 'ab_test_enabled',
    value: 'false',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as ISettingData,
  v1__user_file_max_upload_size: {
    name: 'user_file_max_upload_size',
    value: '10MB',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,
};
