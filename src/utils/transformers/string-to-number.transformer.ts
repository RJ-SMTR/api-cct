import { TransformFnParams } from 'class-transformer/types/interfaces';
import { MaybeType } from '../types/maybe.type';

export const stringToNumberTransformer = (
  params: TransformFnParams,
): MaybeType<number> => {
  if (
    (typeof params.value !== undefined || typeof params.value !== null) &&
    typeof params.value === 'string'
  ) {
    return Number(params.value);
  } else {
    return params.value;
  }
};
