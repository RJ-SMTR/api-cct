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
export class ValidatePipe implements PipeTransform {
  constructor(
    private readonly callback: <T>(value: T) => boolean,
    private readonly args?: {
      errorMessage?: (field: string | undefined, value) => string;
      transform?: (value: any) => any;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): number {
    const callback = this.callback;
    const isValidationPassed = callback(value);
    const field = metadata.data;
    const errorMessage = this.args?.errorMessage;
    const transform = this.args?.transform;

    if (!isValidationPassed) {
      const message = errorMessage
        ? errorMessage(field, value)
        : `${field} : ${value} did not pass validation`;
      throw new BadRequestException(message);
    }
    const transformed = transform ? transform(value) : value;

    return transformed;
  }
}
