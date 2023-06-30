import { Injectable } from '@nestjs/common';

@Injectable()
export class MergeObjectTransformer {
  transformToDto<T extends U, U>(source: T, targetClass: new () => U): U {
    let target = new targetClass();
    target = { ...source };
    return target;
  }
}
