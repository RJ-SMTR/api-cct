import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { SettingDataInterface } from 'src/settings/interfaces/setting-data.interface';

export const settingSeedData: SettingDataInterface[] = [
  // settings for any api version
  {
    name: 'activate_auto_send_invite',
    value: 'false',
    version: null,
    editable: true,
    settingType: SettingTypeEnum.boolean,
  },

  // v1
  {
    name: 'ab_test_enabled',
    value: 'false',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.boolean,
  },
  {
    name: 'user_file_max_upload_size',
    value: '10MB',
    version: '1',
    editable: false,
    settingType: SettingTypeEnum.string,
  },
];
