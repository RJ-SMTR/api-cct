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
