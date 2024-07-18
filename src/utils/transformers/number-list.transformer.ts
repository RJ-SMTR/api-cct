import { TransformFnParams } from 'class-transformer/types/interfaces';
import { MaybeType } from '../types/maybe.type';

export const numberListTransformer = (
  params: TransformFnParams,
): MaybeType<number[]> => {
  const list: string[] = params.value.split(',');
  const numbers = list.map((i) => +i);
  return numbers;
};
