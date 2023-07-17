export interface HttpExceptionResponse {
  statusCode: number;
  error?: string | object;
  errors?: string | object;
  details: string;
}

export interface CustomHttpExceptionResponse extends HttpExceptionResponse {
  uri: string;
  method: string;
  timestamp: Date;
}
