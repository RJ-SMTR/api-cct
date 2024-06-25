import { Transform } from 'class-transformer';

/**
 * @param setValue Callback to set value based on original value
 */
export function SetValue(setValue: (val: any, obj: any) => any) {
  return function (target: any, propertyKey: string) {
    Transform(({ obj }) => setValue(obj[propertyKey], obj), {
      toPlainOnly: true,
    })(target, propertyKey);
  };
}
