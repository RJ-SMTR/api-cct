import { HttpStatus } from '@nestjs/common';
import { Enum } from '../enum';
import { HttpStatusMessage } from '../enums/http-status-message.enum';

export function getHttpStatusMessage(
  httpStatusCode: HttpStatus,
): HttpStatusMessage {
  const statusKey = Enum.getKey(HttpStatus, httpStatusCode);
  return HttpStatusMessage[statusKey];
}
