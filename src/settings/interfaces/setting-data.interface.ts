import { SettingTypeEnum } from '../../setting-types/setting-type.enum';

export interface ISettingData {
  name: string;
  value: string;
  version: string | null;
  editable: boolean;
  settingType: SettingTypeEnum;
}
