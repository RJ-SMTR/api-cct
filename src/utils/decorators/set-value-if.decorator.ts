import { Transform } from 'class-transformer';

export function SetValueIf(
  setIf: (val: any, obj: any) => boolean,
  setNewValue: (val: any, obj: any) => any,
) {
  return function (target: any, propertyKey: string) {
    Transform(
      ({ obj }) => {
        const value = obj[propertyKey];
        const isTrue = setIf(value, obj);
        return isTrue ? setNewValue(value, obj) : value;
      },
      {
        toPlainOnly: true,
      },
    )(target, propertyKey);
  };
}
