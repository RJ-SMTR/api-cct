import { TripsInterface } from './trips.interface';

export interface JaeStopTimesInterface {
  id: number;
  trip_id: TripsInterface;
  stop_sequence: number;
  stop_id: {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
  };
  arrival_time: string;
  departure_time: string;
  shape_dist_traveled: number;
}
