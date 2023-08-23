import { JaeValidatorGtfsDataInterface } from 'src/jae/interfaces/jae-validator-gtfs-data.interface';

export interface ValidatorGtfsDataInterface {
  passValidatorId: string;
  data: JaeValidatorGtfsDataInterface['data'];
}
