import { BadRequestException, Injectable, PipeTransform, ArgumentMetadata, HttpException, HttpStatus } from '@nestjs/common';

/**
 * @param required default is `false`
 */
@Injectable()
export class ParseBooleanPipe implements PipeTransform {
  constructor(
    private readonly args?: {
      optional?: boolean;
      defaultValue?: boolean;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): boolean {
    const defaultValue = this?.args?.defaultValue;
    const field = metadata.data;

    if (!['true', 'false', true, false, undefined].includes(value)) {
      let _value = value;
      if (_value === '') {
        _value = 'got empty string';
      }
      throw new HttpException(`${field}: Invalid boolean value (${_value})`, HttpStatus.BAD_REQUEST);
    }
    const booleanValue = value == 'true' || value == true;

    if (value === undefined || field === undefined) {
      if (this.args?.optional) {
        return value;
      } else if (defaultValue !== undefined) {
        return defaultValue;
      }
    }

    return booleanValue;
  }
}
