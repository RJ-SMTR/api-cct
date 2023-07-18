export interface HttpExceptionResponse {
  statusCode: number;
  statusCodes?: object;
  error?: string | object;
  errors?: object;
  detail?: string;
  details?: object;
}

export interface CustomHttpExceptionResponse extends HttpExceptionResponse {
  uri: string;
  method: string;
  timestamp: Date;
  clientMessage?: object;
  internalMessage?: object;
}
