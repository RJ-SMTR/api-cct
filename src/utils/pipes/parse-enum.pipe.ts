import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface IValidateEnumPipe {
  readonly optional: boolean;
  readonly defaultValue?: any;
}
@Injectable()
export class ParseEnumPipe implements PipeTransform {
  constructor(
    private readonly enumType: Record<string, any>, //
    private readonly options?: IValidateEnumPipe,
  ) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const field = metadata.data;
    if (value === undefined) {
      if (this.options?.optional) {
        return value;
      } else if (this.options?.defaultValue) {
        return this.options.defaultValue;
      }
    }
    const enumValue = this.isEnumValue(value, this.enumType);
    if (!enumValue) {
      throw new BadRequestException(`${field}: Invalid value '${value}'. It must be one of [${Object.values(this.enumType)}].`);
    }
    return value;
  }

  private isEnumValue(value: any, enumType: Record<string, any>): boolean {
    const enumValues = Object.values(enumType);
    return enumValues.includes(value);
  }
}

// /**
//  * @param required default is `false`
//  */
// @Injectable()
// export class ValidateEnumPipe implements PipeTransform {
//     constructor(
//         private readonly args: any,
//     ) {}

//     transform(value: any): number {
//         return value;
//     }
// }
