import { HttpException, HttpStatus, ValidationError } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { getHttpStatusMessage } from './http-exception/http-exception-utils';
import { InvalidRows } from './types/invalid-rows.type';

const SEPARATOR = '; ';

/**
 * @param throwOnError default: true
 */
export async function validateDTO(
  dto: any,
  object: any,
  throwOnError = true,
): Promise<InvalidRows> {
  const schema = plainToInstance(dto, object);
  const errors = await validate(schema as Record<string, any>, {
    stopAtFirstError: true,
  });
  const invalidRows = getInvalidRows(errors);
  if (errors.length > 0 && throwOnError) {
    const code = HttpStatus.UNPROCESSABLE_ENTITY;
    throw new HttpException(
      {
        error: getHttpStatusMessage(code),
        details: {
          message: 'Object failed passing through DTO',
          errors: invalidRows,
        },
      },
      code,
    );
  } else {
    return invalidRows;
  }
}

export function getInvalidRows(errors: ValidationError[]): InvalidRows {
  return errors.reduce((result, error) => {
    const { property, constraints } = error;
    if (property && constraints) {
      result[property] = Object.values(constraints).join(SEPARATOR);
    }
    return result;
  }, {});
}

export function hasValue(value: any) {
  return value !== undefined && value !== null
}