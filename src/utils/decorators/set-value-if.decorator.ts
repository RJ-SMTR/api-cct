import { Transform } from 'class-transformer';

export function SetValueIf(predicate: (object: any) => boolean, newValue: any) {
  return function (target: any, propertyKey: string) {
    Transform(({ obj }) => (predicate(obj) ? newValue : obj[propertyKey]), {
      toPlainOnly: true,
    })(target, propertyKey);
  };
}
