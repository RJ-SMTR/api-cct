import { TransformFnParams } from 'class-transformer/types/interfaces';
import { MaybeType } from '../types/maybe.type';

/**
 * Transform value into a string list
 */
export const listTransformer = (
  params: TransformFnParams,
): MaybeType<string[]> => {
  const list: string[] = params.value.split(',');
  return list;
};
