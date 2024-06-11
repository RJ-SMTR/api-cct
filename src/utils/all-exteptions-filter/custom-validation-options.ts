/**
 * Once`ValidationOptions` doesn't allow extra parameters, this is the only low coupling solution found so far - Adapter Design Pattern.
 * @requires validationOptions - is expected its output data (`errors` instead of `message`)
 */

import { ValidationOptions } from 'class-validator';
import { asJSONStrOrObj } from '../pipe-utils';
import { HttpExceptionResponse } from './interfaces/http-exception-response.interface';

export interface CustomValidationOptions extends ValidationOptions {
  statusCode?: number;
  details?: string | object;
}

interface SerializedValidationOptions {
  statusCode: number;
  error: string;
  details: string;
}

interface DecodedList {
  statusCodes: number[];
  errors: string[];
  details: string[];
}

/**
 * A helper to pass extra error parameters from class-validator to a global errorFilter or similar.
 * @returns ValidationOptions with JSON encoding `message` and extra fields in `message` field.
 */
export function customValidationOptions(
  validationOptions: CustomValidationOptions,
): ValidationOptions {
  const extraFields: CustomValidationOptions = {
    ...(validationOptions?.statusCode && {
      statusCode: validationOptions.statusCode,
    }),
    ...(validationOptions?.details && { details: validationOptions.details }),
  };
  return {
    ...validationOptions,
    message: JSON.stringify({
      error: validationOptions.message,
      ...extraFields,
    }),
  };
}

interface BehaviorOptions {
  setLowestStatus?: boolean;
  setMainMessage?: boolean;
}

/**
 * Deserialize extra parameters from JSON into `errors` and `details` fields (if exists).
 * @param errorResponse.errors If empty, no default value will be set.
 * @param behavior.setLowestStatus Set lowest `satusCode` and related `error` message.
 * @returns The same HttpException but with decoded data for customValidation
 */
export function getCustomValidationOptions(
  errorResponse: HttpExceptionResponse,
  behavior: BehaviorOptions = {
    setLowestStatus: true,
  },
): Partial<HttpExceptionResponse> | null {
  if (!errorResponse?.errors) {
    return null;
  }
  const newResponse: Partial<HttpExceptionResponse> = { ...errorResponse };
  newResponse.errors = {};
  newResponse.details = {};
  newResponse.statusCodes = {};
  const decodedList: DecodedList = {
    details: [],
    errors: [],
    statusCodes: [],
  };
  let decodedLowestStatus: SerializedValidationOptions | undefined;
  for (const [errorKey, errorValue] of Object.entries(errorResponse.errors)) {
    const substrings = asJSONStrOrObj(errorValue)
      .split(/,(?![^{}]*})/)
      .map((substring) => substring.trim());
    const list: DecodedList = {
      details: [],
      errors: [],
      statusCodes: [],
    };
    for (const substring of substrings) {
      try {
        const decodedJson: SerializedValidationOptions = JSON.parse(substring);
        const { statusCode, error, details } = decodedJson;
        error && list.errors.push(error);
        details && list.details.push(details);
        statusCode && list.statusCodes.push(statusCode);
        if (
          statusCode &&
          (!decodedLowestStatus || decodedLowestStatus.statusCode > statusCode)
        ) {
          decodedLowestStatus = decodedJson;
        }
      } catch (error) {
        list.errors.push(substring);
      }
    }
    for (const listKey in list) {
      if (list[listKey].length) {
        newResponse[listKey][errorKey] = list[listKey].join(', ');
      }
    }
  }
  for (const responseListField in decodedList) {
    if (!Object.keys(newResponse[responseListField]).length) {
      delete newResponse[responseListField];
    }
  }

  const { setLowestStatus, setMainMessage } = behavior;
  if (setLowestStatus === true) {
    if (decodedLowestStatus) {
      newResponse.statusCode = decodedLowestStatus.statusCode;
    }
  }
  if (setMainMessage === true) {
    if (decodedLowestStatus?.error) {
      newResponse.error = decodedLowestStatus.error;
    }
  }
  return newResponse;
}
