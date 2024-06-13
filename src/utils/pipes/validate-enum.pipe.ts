import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ValidateEnumPipe implements PipeTransform {
  constructor(
    private readonly enumType: Record<string, any>,
    private readonly required: boolean = false,
    private readonly defaultValue?: any,
  ) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (value === undefined) {
      return this.defaultValue;
    }
    const enumValue = this.isEnumValue(value, this.enumType);
    if (!enumValue) {
      throw new BadRequestException(
        `Invalid ${metadata.type} value. It must be one of [${Object.values(
          this.enumType,
        )}].`,
      );
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
