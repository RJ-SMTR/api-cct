import { PipeTransform, Type } from '@nestjs/common';

export type QueryParamsType = [
  string,
  ...Array<Type<PipeTransform> | PipeTransform>,
];
