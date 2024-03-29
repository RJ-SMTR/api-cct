import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  CustomHttpExceptionResponse,
  HttpExceptionResponse,
} from '../interfaces/http-exception-response.interface';
import { getCustomValidationOptions } from '../custom-validation-options';
import { formatErrorMessage } from 'src/utils/log-utils';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const logger: Logger = new Logger('AllExceptionsFilter');

    const responseData = this.getResponseData({
      exception: exception,
      request: request,
    });

    logger.error(this.getErrorLogSummary(responseData, exception));

    response.status(responseData.statusCode).json(
      responseData?.response || {
        status: responseData.statusCode,
        ...responseData.clientMessage,
        timestamp: responseData.timestamp,
      },
    );
  }

  private getResponseData(kwargs: {
    exception: unknown;
    request: Request;
  }): CustomHttpExceptionResponse {
    const { exception, request } = kwargs;
    let responseData: CustomHttpExceptionResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      uri: request.url,
      method: request.method,
      timestamp: new Date(),
    };

    if (exception instanceof HttpException) {
      const httpResponse = exception.getResponse() as HttpExceptionResponse;
      const customResponse = getCustomValidationOptions(httpResponse, {
        setLowestStatus: true,
        setMainMessage: true,
      });

      responseData = {
        ...responseData,
        statusCode: exception.getStatus(),
        ...(customResponse || httpResponse),
      };
    }
    if (responseData?.message) {
      responseData.clientMessage = { message: responseData.message };
    } else if (responseData?.response) {
      responseData.clientMessage = responseData.response;
    } else if (responseData?.error) {
      responseData.clientMessage = { error: responseData.error };
    } else if (responseData?.errors) {
      responseData.clientMessage = { errors: responseData.errors };
    }
    if (responseData?.details) {
      responseData.internalMessage = { details: responseData.details };
    } else if (responseData?.detail) {
      responseData.internalMessage = { detail: responseData.detail };
    }

    return responseData;
  }

  private getErrorLogSummary = (
    errorResponse: CustomHttpExceptionResponse,
    exception: unknown,
  ): string => {
    const { statusCode, clientMessage, method, uri, internalMessage } =
      errorResponse;

    const errorLog = formatErrorMessage(
      `Code: ${statusCode} - ${method}: ${uri}`,
      { ...clientMessage, ...internalMessage },
      exception instanceof Error ? (exception as Error) : undefined,
    );

    return errorLog;
  };
}
