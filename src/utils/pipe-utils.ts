/**
 * Simple pipe helpers
 */

export function asString(str: string | null | undefined, fieldName?: string): string {
  const field = fieldName || 'String';
  if (typeof str !== 'string') {
    throw new Error(`${field} is not string, but ${str}`);
  }
  return str;
}

export function asFilledString(str: string | null | undefined, fieldName?: string): string {
  const field = fieldName || 'String';
  const validStr = asString(str);
  if (validStr?.length === 0) {
    throw new Error(`${field} should not be empty`);
  }
  return validStr;
}

export function asDate(date: Date | null | undefined, fieldName?: string): Date {
  const field = fieldName || 'Date';
  if (date === null || date === undefined) {
    throw new Error(`${field} is not string, but ${date}`);
  }
  return date;
}

export function asStringDate(str: string | null | undefined, fieldName?: string): Date {
  const field = fieldName || 'StringDate';
  return asValidDate(new Date(asString(str)), field);
}

export function asNullableStringDate(str: string | null | undefined, fieldName?: string): Date | null {
  const field = fieldName || 'NullableStringDate';
  return str ? asValidDate(new Date(asString(str)), field) : null;
}

export function asValidDate(date: Date | null | undefined, fieldName?: string): Date {
  const field = fieldName || 'Date';
  const validDate = asDate(date);
  if (isNaN(validDate.getDate())) {
    throw new Error(`${field} is invalid date, but ${date}`);
  }
  return validDate;
}

export function asNumber(num: number | null | undefined, fieldName?: string): number {
  const field = fieldName || 'Number';
  if (typeof num !== 'number') {
    throw new Error(`${field} is not number, but ${num}`);
  }
  return num;
}

export function asInteger(num: number | null | undefined, fieldName?: string): number {
  const field = fieldName || 'Number';
  const validNum = asNumber(num);
  if (!Number.isInteger(validNum)) {
    throw new Error(`${field} should be integer, but got ${validNum}`);
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
    throw new Error(`${field} is not boolean, but ${bool}`);
  }
  return bool;
}