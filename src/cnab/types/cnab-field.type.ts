import { isArrayContainEqual } from 'src/utils/array-utils';

export type CnabField = {
  pos: [number, number];
  picture: string;
  value: any;
  default?: any;
  /**
   * date-fns date format
   * @see{@link https://date-fns.org/v3.3.1/docs/format}
   */
  dateFormat?: string;
};

export function isCnabField(value: any) {
  return (
    typeof value === 'object' &&
    isArrayContainEqual(Object.keys(value), ['pos', 'picture', 'value']) &&
    typeof value?.picture === 'string' &&
    typeof value?.pos[0] === 'number' &&
    typeof value?.pos[1] === 'number'
  );
}
