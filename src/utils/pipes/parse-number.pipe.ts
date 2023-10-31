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
    private readonly args: { min?: number; max?: number; required?: boolean },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): number {
    const isMin = this.args?.min !== undefined;
    const isMax = this.args?.max !== undefined;
    const field = metadata.data;

    const numberValue = Number(value);

    if (!this.args.required && (value === undefined || field === undefined)) {
      return numberValue;
    } else if (value !== undefined && isNaN(numberValue)) {
      throw new BadRequestException(
        `${field} should be a valid number: ${value}`,
      );
    }

    if (
      (isMin && numberValue < (this.args?.min as number)) ||
      (isMax && numberValue > (this.args?.max as number))
    ) {
      let returnSubstring = '';
      if (isMin && !isMax) {
        returnSubstring = `greather or equal than ${this.args.min as number}`;
      }
      if (!isMin && isMax) {
        returnSubstring = `lower or equal than ${this.args.max as number}`;
      }
      if (isMin && isMax) {
        returnSubstring = `between ${this.args.min as number} and  ${
          this.args.max as number
        }`;
      }
      throw new BadRequestException(
        `${metadata.data} should be an integer ${returnSubstring}`,
      );
    }
    return numberValue;
  }
}
