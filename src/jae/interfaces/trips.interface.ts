export interface TripsInterface {
  route_id: {
    route_id: string;
    agency_id: string;
    route_short_name: string;
    route_long_name: string;
    route_desc: string;
  };
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  trip_short_name: string;
  direction_id: number;
  block_id: string | null;
  shape_id: string;
}
