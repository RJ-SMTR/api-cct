import { appSettings } from 'src/settings/app.settings';
import { SettingsRecordType } from 'src/settings/types/settings-record.type';

export const settingSeedData = [
  ...Object.values(appSettings as SettingsRecordType),
];
