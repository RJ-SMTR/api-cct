import { JaeStopTimesInterface } from './jae-stop-times.interface';
import { TripsInterface } from './trips.interface';

export interface JaeValidatorGtfsDataInterface {
  passValidatorId: string;
  data: [
    {
      trip: TripsInterface;
      stopTimes: JaeStopTimesInterface[];
    },
  ];
}
