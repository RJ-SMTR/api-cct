import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * @param required default is `false`
 */
@Injectable()
export class MinMaxNumberPipe implements PipeTransform {
  constructor(
    private readonly args: { min?: number; max?: number; required?: boolean },
  ) {}

  transform(value: any): number {
    const isMin = this.args?.min !== undefined;
    const isMax = this.args?.max !== undefined;

    if (value === undefined && !this.args.required) {
      return value;
    } else if (isNaN(value)) {
      throw new BadRequestException(`Value should be a valid number ${value}`);
    }
    const numberValue = Number(value);

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
      if (!isMin && isMax) {
        returnSubstring = `between ${this.args.min as number} and  ${
          this.args.max as number
        }`;
      }
      throw new BadRequestException(
        `Value should be an integer ${returnSubstring}`,
      );
    }

    return numberValue;
  }
}
