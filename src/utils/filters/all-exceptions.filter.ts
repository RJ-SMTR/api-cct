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
    let details: string;

    console.log(JSON.stringify(exception));
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse() as HttpExceptionResponse;

      details =
        errorResponse.details ||
        (exception?.['options'] as HttpExceptionOptions)?.description ||
        '';
      errorMessage = exception.message;
      if (typeof errorResponse.error === 'string') {
        errorMessage =
          errorResponse.error || JSON.stringify(errorResponse?.['errors']);
      } else if (
        Object.prototype.toString.call(errorResponse.error) === '[object Array]'
      ) {
        errorMessage = errorResponse.error[0];
        errorResponse.error?.[1] && (details = errorResponse.error[1]);
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
      error: errorResponse.error,
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
