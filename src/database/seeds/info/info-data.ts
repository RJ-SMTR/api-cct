import { InfoData } from 'src/info/info-data.interface';

export const infoData: InfoData[] = [
  // settings for any api version
  { name: 'maintenance', value: 'false' },

  // v1
  { name: 'abTestEnabled', value: 'false', version: '1' },
  { name: 'maxUploadSize', value: '10MB', version: '1' },
];
