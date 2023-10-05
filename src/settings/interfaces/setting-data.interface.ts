import { SettingTypeEnum } from '../../setting-types/setting-type.enum';

// info-data.interface.ts
export interface SettingDataInterface {
  name: string;
  value: string;
  version: string | null;
  editable: boolean;
  settingType: SettingTypeEnum;
}
