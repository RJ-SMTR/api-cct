/**
 * Simple pipe helpers
 */

import { isDate } from "date-fns";
import { getDateFromString } from "./date-utils";
import { CommonHttpException } from "./http-exception/common-http-exception";
import { isNumberString } from "class-validator";
import { isDefined, isContent } from "./type-utils";

export function asStringOrEmpty(str: string | null | undefined, message?: string): string {
  if (str === null || str === undefined) {
    return '';
  }
  if (typeof str !== 'string') {
    throw CommonHttpException.details(
      message || `value is not string, but ${typeof str}, value: ${str}`,
    );
  }
  return str;
}

export function asString(str: string | null | undefined, errMsg?: string): string {
  if (typeof str !== 'string') {
    throw CommonHttpException.details(
      `${errMsg || 'String'} is not string, but ${typeof str}, value: ${str}`,
    );
  }
  return str;
}

export function asFilledString(str: string | null | undefined, errMsg?: string): string {
  const validStr = asString(str, errMsg);
  if (validStr?.length === 0) {
    throw CommonHttpException.details(
      errMsg || `String should not be empty`,
    );
  }
  return validStr;
}

export function asDate(date: Date | null | undefined, fieldName?: string): Date {
  const field = fieldName || 'Date';
  if (date === null || date === undefined || !isDate(date)) {
    throw CommonHttpException.details(
      `${field} is not Date, but ${typeof date}, value: ${date}`,
    );
  }
  else if (isNaN(date.getDate())) {
    throw CommonHttpException.details(
      `${field} is invalid date, but ${typeof date}, value: ${date}`,
    );
  }
  return date;
}

export function asStringOrDateDate(str: string | Date, inputFormat?: string, fieldName?: string): Date {
  const field = fieldName ? fieldName : 'StringDate';
  if (typeof str === 'string') {
    return getDateFromString(str, inputFormat);
  }
  else if (isDate(str)) {
    return str;
  } else {
    throw CommonHttpException.details(
      `${field} should be nullable string | date , but got ${typeof str}, value: ${str}`,
    );
  }
}

export function asNullableStringOrDateTime(str: string | Date | null | undefined, date?: Date | null | undefined, inputFormat?: string, fieldName?: string): Date | null {
  const field = fieldName ? fieldName : 'StringDate';
  if (typeof str === 'string') {
    const validStr = asString(str);
    const baseTime = new Date(`0 ${validStr}`);
    const time = date ? new Date(date) : new Date();
    time.setHours(baseTime.getHours(), baseTime.getMinutes(), baseTime.getSeconds());
    return time;
  }
  else if (!str) {
    return null;
  }
  else if (isDate(str)) {
    return str;
  } else {
    throw CommonHttpException.details(
      `${field} should be nullable string | date , but got ${typeof str}, value: ${str}`,
    );
  }
}

export function asStringOrDateTime(str: string | Date, date?: Date | null | undefined, inputFormat?: string, fieldName?: string): Date {
  const field = fieldName ? fieldName : 'StringDate';
  if (typeof str === 'string') {
    const validStr = asString(str);
    const baseTime = new Date(`0 ${validStr}`);
    const time = date ? new Date(date) : new Date();
    time.setHours(baseTime.getHours(), baseTime.getMinutes(), baseTime.getSeconds());
    return time;
  }
  else if (isDate(str)) {
    return str;
  } else {
    throw CommonHttpException.details(
      `${field} should be nullable string | date , but got ${typeof str}, value: ${str}`,
    );
  }
}

export function asNumberStringDate(str: string | null | undefined, inputFormat?: string, fieldName?: string): Date {
  const field = fieldName ? fieldName : 'StringDate';
  if (!isNumberString(str)) {
    throw CommonHttpException.details(`${field} should be NumberString, but got '${str}'`);
  }
  const validVal = String(str);
  return getDateFromString(validVal, inputFormat, true);
}

export function asStringDate(str: string | null | undefined, inputFormat?: string): Date {
  const validVal = String(str);
  return getDateFromString(validVal, inputFormat, true);
}

export function asNullableStringDate(str: string | null | undefined, inputFormat?: string): Date | null {
  return str ? asStringDate(str, inputFormat) : null
}

export function asStringOrNumber(val: string | number | null | undefined, fieldName?: string): number {
  const field = fieldName || 'StringOrNumber';
  if (typeof val === 'string') {
    return asStringNumber(val, field);
  } else {
    return asNumber(val, field);
  }
}

export function asNullableStringOrNumber(val: string | number | null | undefined, fieldName?: string): number | null {
  const field = fieldName || 'StringOrNumber';
  if (typeof val === 'string') {
    return asStringNumber(val, field);
  } else if (typeof val === 'number') {
    return asNumber(val, field);
  } else {
    return null;
  }
}

export function asNullableStringNumber(str: string | null | undefined, fieldName?: string, allowNaN = false): number | null {
  const field = fieldName || 'Number';
  if (str === null || str === undefined) {
    return null;
  } else {
    return asNumber(Number(asString(str, field)), field, allowNaN);
  }
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

export function asStringBoolean(str: string | null | undefined, fieldName?: string): boolean {
  const field = fieldName || 'StringBoolean';
  if (typeof str !== 'string' && str !== undefined && str !== null) {
    throw CommonHttpException.details(
      `${field} is not boolean, but ${typeof str}, value: ${str}`,
    );
  }
  return str?.toLowerCase() === 'true';
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

export function asObject<T>(obj: T | null | undefined, fieldName?: string): T {
  const field = fieldName || 'NullableObject';
  if (obj === null || obj === undefined) {
    throw CommonHttpException.details(
      `${field} is nullable: ${typeof obj}`,
    );
  }
  return obj;
}

export function asDefinedContent<T>(val: T | undefined | null, field = 'Value'): T {
  if (!isDefined(val)) {
    throw CommonHttpException.details(`${field} should not be undefined.`);
  }
  if (!isContent(val)) {
    throw CommonHttpException.details(`${field} should not be null.`);
  }
  return val;
}

export function asDefined<T>(val: T | undefined, field = 'Value'): T {
  if (!isDefined(val)) {
    throw CommonHttpException.details(`${field} should not be undefined.`);
  }
  return val;
}

export function asContent<T>(val: T | null, field = 'Value'): T {
  if (!isContent(val)) {
    throw CommonHttpException.details(`${field} should not be undefined.`);
  }
  return val;
}