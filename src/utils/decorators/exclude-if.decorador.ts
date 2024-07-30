import { ExcludeOptions } from 'class-transformer';
import 'reflect-metadata';

type ExcludeIfCallback = (value: any, object: any) => boolean;

function ExcludeIf(
  callback: ExcludeIfCallback,
  options?: ExcludeOptions,
): PropertyDecorator & ClassDecorator {
  return (target: Object, propertyKey?: string | symbol) => {
    if (propertyKey) {
      Reflect.defineMetadata('excludeIf', callback, target, propertyKey);
    } else {
      Reflect.defineMetadata('excludeIf', callback, target);
    }
  };
}

export { ExcludeIf };
