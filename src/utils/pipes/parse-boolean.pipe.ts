import {
  BadRequestException,
  Injectable,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';

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

    const booleanValue = value == 'true';

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
