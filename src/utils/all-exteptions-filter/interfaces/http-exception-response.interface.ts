export interface HttpExceptionResponse {
  statusCode: number;
  statusCodes?: object;
  message?: string;
  error?: string | object;
  errors?: object;
  detail?: string;
  details?: object;
  response?: object;
}

export interface CustomHttpExceptionResponse extends HttpExceptionResponse {
  uri: string;
  method: string;
  timestamp: Date;
  clientMessage?: object;
  internalMessage?: object;
}
