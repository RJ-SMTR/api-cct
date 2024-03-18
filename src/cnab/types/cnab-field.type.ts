import { isArrayContainEqual } from 'src/utils/array-utils';

export type CnabField = {
  pos: [number, number];
  picture: string;
  value: any;
  /** 
   * Will use date-fns or new Date() date format
   * 
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   */
  dateFormat?: ICnabFieldDateFormat;
};

export type CnabFieldAs<T> = {
  pos: [number, number];
  picture: string;
  value: T;
  /**
   * date-fns date format
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   */
};

/**
 * Input: optional. When reading Retorno.
 * - `undefined`: Current date will be used as input of new Date()
 * - `string`: Will use date-fns date format
 *
 * Output: mandatory. When writing Remessa.
 * - Desired string output format. Will use date-fns date format
 *
 * @see{@link https://date-fns.org/v3.3.1/docs/format}
 */
export interface ICnabFieldDateFormat {
  input?: string;
  output: string;
}

export type CnabFields = Record<string, CnabField>;

export function isCnabField(value: any) {
  return (
    typeof value === 'object' &&
    isArrayContainEqual(Object.keys(value), ['pos', 'picture', 'value']) &&
    typeof value?.picture === 'string' &&
    typeof value?.pos[0] === 'number' &&
    typeof value?.pos[1] === 'number'
  );
}
