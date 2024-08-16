import { ExcludeOptions, Transform } from 'class-transformer';
import 'reflect-metadata';

function ExcludeIf(setIf: (val: any, obj: any) => boolean) {
  return function (target: any, propertyKey: string) {
    Transform(
      ({ obj }) => {
        const value = obj[propertyKey];
        const isTrue = setIf(value, obj);
        return isTrue ? undefined : value;
      },
      {
        toPlainOnly: true,
      },
    )(target, propertyKey);
  };
}

export { ExcludeIf };
