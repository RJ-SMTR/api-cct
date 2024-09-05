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
export class ParseNumberPipe implements PipeTransform {
  constructor(
    private readonly args?: {
      min?: number;
      max?: number;
      optional?: boolean;
      defaultValue?: number;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): number {
    const min = this?.args?.min;
    const max = this?.args?.max;
    const defaultValue = this?.args?.defaultValue;
    const isMin = this.args?.min !== undefined;
    const isMax = this.args?.max !== undefined;
    const field = metadata.data;

    const numberValue = Number(value);

    if (value === undefined || field === undefined) {
      if (this.args?.optional) {
        return value;
      } else if (defaultValue !== undefined) {
        return defaultValue;
      }
    }

    if (value !== undefined && isNaN(numberValue) || value === '') {
      throw new BadRequestException(
        `'${field}' should be a valid number: got '${value}'`,
      );
    }

    if (
      (min !== undefined && numberValue < min) ||
      (max !== undefined && numberValue > max)
    ) {
      let returnSubstring = '';
      if (isMin && !isMax) {
        returnSubstring = `greater or equal than ${min}`;
      }
      if (!isMin && isMax) {
        returnSubstring = `lower or equal than ${max}`;
      }
      if (isMin && isMax) {
        returnSubstring = `between ${min} and ${max}`;
      }
      throw new BadRequestException(
        `'${field}' should be an integer ${returnSubstring}`,
      );
    }
    return numberValue;
  }
}
