import { TransformFnParams } from 'class-transformer/types/interfaces';
import { MaybeType } from '../types/maybe.type';
import { asStringDate } from '../pipe-utils';
import { startOfDay } from 'date-fns';

interface IDateTransformerOptions {
  /** Store date and time values, instead of only date */
  dateTime?: boolean;
}

export const dateTransformer = (
  params: TransformFnParams,
  options?: IDateTransformerOptions,
): MaybeType<Date> => {
  let date = asStringDate(params.value);
  if (!options?.dateTime) {
    date = startOfDay(date);
  }
  return date;
};
