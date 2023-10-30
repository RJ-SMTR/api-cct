import { HttpStatus } from '@nestjs/common';

export enum HttpErrorMessages {
  INTERNAL_SERVER_ERROR = 'InternalServerError',
  AUTHENTICATION_FAILED = 'AuthenticationFailed',
  SETTING_NOT_FOUND = 'SettingNotFound',
  USER_NOT_FOUND = 'UserNotFound',
  NOT_FOUND = 'NotFound',
  UNAUTHORIZED = 'Unauthorized',
  UNPROCESSABLE_ENTITY = 'UnprocessableEntity',
}
HttpStatus;
