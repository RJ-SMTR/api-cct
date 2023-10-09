import { SettingTypeEnum } from '../../setting-types/setting-type.enum';

export interface SettingDataInterface {
  name: string;
  value: string;
  version: string | null;
  editable: boolean;
  settingType: SettingTypeEnum;
}
