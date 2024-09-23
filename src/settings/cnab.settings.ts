import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { ISettingData } from './interfaces/setting-data.interface';

/**
 * Helper for default settings
 * @_type SettingsRecordType
 */
export const cnabSettings = {
  // any version

  any__cnab_last_nsr_sequence: {
    name: 'cnab_last_nsr_sequence',
    /** Starts with 0, next will be 1 */
    value: '0',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as ISettingData,

  any__cnab_current_nsr_sequence: {
    name: 'cnab_current_nsr_sequence',
    /** Starts with 0, next will be 1 */
    value: '0',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as ISettingData,

  any__cnab_current_nsr_date: {
    name: 'cnab_current_nsr_date',
    /** Starts with 0, next will be 1 */
    value: '0001-01-01',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.string,
  } as ISettingData,

  any__cnab_jobs_enabled: {
    name: 'cnab_jobs_enabled',
    /** Starts with 0, next will be 1 */
    value: 'false',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.boolean,
  } as ISettingData,

  any__cnab_current_nsa: {
    name: 'cnab_current_nsa',
    /** Starts with 0, next will be 1 */
    value: '0',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as ISettingData,

  any__cnab_current_nsa_test: {
    name: 'cnab_current_nsa_test',
    /** Starts with 0, next will be 1 */
    value: '0',
    version: null,
    editable: false,
    settingType: SettingTypeEnum.number,
  } as ISettingData,
};
