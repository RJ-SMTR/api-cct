import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpExceptionOptions,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  CustomHttpExceptionResponse,
  HttpExceptionResponse,
} from '../interfaces/http-exception-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: object, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const logger: Logger = new Logger('AllExceptionsFilter');

    let status: HttpStatus;
    let errorMessage: string;
    let errorKeyName = 'error';
    let details: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const options = exception?.['options'] as HttpExceptionOptions;
      const errorResponse = exception.getResponse() as HttpExceptionResponse;
      details = errorResponse.details || options?.description || '';

      const isErrorString: boolean = typeof errorResponse.error === 'string';
      const isErrorArray: boolean =
        Object.prototype.toString.call(errorResponse.error) ===
        '[object Array]';
      if (isErrorString) {
        try {
          const decodedError = JSON.parse(errorResponse.error as string);
          errorMessage = decodedError?.error;
          details = decodedError?.details;
        } catch (error) {
          errorMessage = errorResponse.error as string;
        }
      } else if (errorResponse.error && isErrorArray) {
        errorMessage = errorResponse.error[0];
        errorResponse.error?.[1] && (details = errorResponse.error[1]);
      } else if (errorResponse?.errors) {
        errorKeyName = 'errors';
        errorMessage = errorResponse.errors as string;
      } else {
        errorMessage = exception.message;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Critical internal server error occurred!';
      details = '';
    }

    const errorResponse = this.getErrorResponse(
      status,
      errorMessage,
      details,
      request,
    );
    const errorSummary = this.getErrorLogSummary(errorResponse, request);
    logger.error(errorSummary);
    response.status(status).json({
      status: errorResponse.statusCode,
      [errorKeyName]: errorResponse.error,
      timestamp: errorResponse.timestamp,
    });
  }

  private getErrorResponse = (
    status: HttpStatus,
    errorMessage: string,
    details: string,
    request: Request,
  ): CustomHttpExceptionResponse => ({
    statusCode: status,
    error: errorMessage,
    details: details,
    uri: request.url,
    method: request.method,
    timestamp: new Date(),
  });

  private getErrorLogSummary = (
    errorResponse: CustomHttpExceptionResponse,
    request: Request,
  ): string => {
    const { statusCode, error, details: details } = errorResponse;
    const { method, url } = request;
    const errorLog = `Code: ${statusCode} - Method: ${method} - URL: ${url} - Error: ${error} - Details: ${JSON.stringify(
      details,
    )}`;
    return errorLog;
  };
}
