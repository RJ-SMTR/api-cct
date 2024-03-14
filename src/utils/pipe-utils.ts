/**
 * Simple pipe helpers
 */

import { getDateFromString } from "./date-utils";
import { CommonHttpException } from "./http-exception/common-http-exception";

export function asString(str: string | null | undefined, fieldName?: string): string {
  const field = fieldName || 'String';
  if (typeof str !== 'string') {
    throw CommonHttpException.details(
      `${field} is not string, but ${str}`,
    );
  }
  return str;
}

export function asFilledString(str: string | null | undefined, fieldName?: string): string {
  const field = fieldName || 'String';
  const validStr = asString(str);
  if (validStr?.length === 0) {
    throw CommonHttpException.details(
      `${field} should not be empty`,
    );
  }
  return validStr;
}

export function asDate(date: Date | null | undefined, fieldName?: string): Date {
  const field = fieldName || 'Date';
  if (date === null || date === undefined) {
    throw CommonHttpException.details(
      `${field} is not string, but ${date}`,
    );
  }
  else if (isNaN(date.getDate())) {
    throw CommonHttpException.details(
      `${field} is invalid date, but ${date}`,
    );
  }
  return date;
}

export function asStringDate(str: string | null | undefined, inputFormat?: string, fieldName?: string): Date {
  const field = fieldName ? fieldName : 'StringDate';
  const validStr = asString(str, field);
  return getDateFromString(validStr, inputFormat, true);
}

export function asNullableStringDate(str: string | null | undefined, inputFormat?: string, fieldName?: string): Date | null {
  const field = fieldName ? fieldName : 'NullableStringDate';
  return str ? asStringDate(str, inputFormat, field) : null;
}

export function asStringNumber(str: string | null | undefined, fieldName?: string, allowNaN = false): number {
  const field = fieldName || 'Number';
  return asNumber(Number(asString(str, field)), field, allowNaN);
}

export function asNumber(num: number | null | undefined, fieldName?: string, allowNaN = false): number {
  const field = fieldName || 'Number';
  if (typeof num !== 'number') {
    throw CommonHttpException.details(
      `${field} is not number, but ${num}`,
    );
  }
  if (isNaN(num) && !allowNaN) {
    throw CommonHttpException.details(
      `${field} should not be NaN , but got ${num}`,
    );
  }
  return num;
}

export function asInteger(num: number | null | undefined, fieldName?: string): number {
  const field = fieldName || 'Number';
  const validNum = asNumber(num);
  if (!Number.isInteger(validNum)) {
    throw CommonHttpException.details(
      `${field} should be integer, but got ${validNum}`,
    );
  }
  return validNum;
}

export function asDecimal(num: number | null | undefined, fieldName?: string): number {
  const field = fieldName || 'Number';
  const validNum = asNumber(num);
  // 23 % 1 = 0;      23.5 % 1 = 0.5
  if (validNum % 1 === 0) {
    throw new Error(`${field} should be decimal, but got ${validNum}`);
  }
  return validNum;
}


export function asBoolean(bool: boolean | null | undefined, fieldName?: string): boolean {
  const field = fieldName || 'Boolean';
  if (typeof bool !== 'boolean') {
    throw CommonHttpException.details(
      `${field} is not boolean, but ${bool}`,
    );
  }
  return bool;
}

export function asJSONStrOrObj(str: string | object): string {
  if (typeof str === 'string') {
    return str
  } else {
    try {
      return JSON.stringify(str);
    } catch (e) {
      return String(str);
    }
  }
}