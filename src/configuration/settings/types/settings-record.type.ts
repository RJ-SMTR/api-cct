import { ISettingDataGroup } from '../interfaces/setting-data-group.interface';
import { ISettingData } from '../interfaces/setting-data.interface';

export type SettingsRecordType = Record<
  string,
  ISettingData | ISettingDataGroup
>;
