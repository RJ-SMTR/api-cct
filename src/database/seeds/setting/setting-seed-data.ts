import { appSettings } from 'src/configuration/settings/app.settings';
import { SettingsRecordType } from 'src/configuration/settings/types/settings-record.type';

export const settingSeedData = [
  ...Object.values(appSettings as SettingsRecordType),
];
