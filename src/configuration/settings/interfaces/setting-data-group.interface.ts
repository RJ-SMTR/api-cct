import { ISettingData } from './setting-data.interface';

export interface ISettingDataGroup {
  baseName: string;
  baseVersion: string | null;
  data: ISettingData[];
}
