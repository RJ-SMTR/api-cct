import { appSettings } from 'src/settings/app.settings';
import { SettingDataInterface } from 'src/settings/interfaces/setting-data.interface';
import { SettingsRecordType } from 'src/settings/types/settings-record.type';

export const settingSeedData: SettingDataInterface[] = [
  ...Object.values(appSettings as SettingsRecordType),
];
