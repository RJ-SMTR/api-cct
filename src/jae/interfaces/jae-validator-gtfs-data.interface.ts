import { JaeStopTimesInterface } from './jae-stop-times.interface';
import { TripsInterface } from './trips.interface';

export interface JaeValidatorGtfsDataInterface {
  validador: string;
  data: [
    {
      trip: TripsInterface;
      stopTimes: JaeStopTimesInterface[];
    },
  ];
}
