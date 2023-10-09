import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { SettingDataInterface } from './interfaces/setting-data.interface';

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
