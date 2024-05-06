import { TransformFnParams } from 'class-transformer/types/interfaces';
import { MaybeType } from '../types/maybe.type';

export const stringTransformer = (
  params: TransformFnParams,
): MaybeType<string> => {
  if (typeof params.value !== undefined || typeof params.value !== null) {
    return String(params.value);
  } else {
    return params.value;
  }
};
