export interface IRequest {
  user: {
    id: number;
  };
  method: string;
  protocol: string;
  originalUrl: string;
  get(x: string): any;
}
