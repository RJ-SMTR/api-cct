import {
  BadRequestException,
  Injectable,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';
import { isNumberString, isString } from 'class-validator';
import { isArrayUnique } from '../array-utils';

/**
 * Valida se é uma lsita numérica
 */
@Injectable()
export class ValidateNumberListPipe implements PipeTransform {
  constructor(
    private readonly args?: {
      /** If must have unique values */
      unique?: boolean;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): number[] {
    const field = metadata.data;
    const unique = this.args?.unique;

    if (
      !(isString(value) && value.split(',').every((i) => isNumberString(i)))
    ) {
      throw new BadRequestException(
        `${field}: ${value} is not a valid number list separated by comma.`,
      );
    }
    const strList = value.split(',');
    if (unique && !isArrayUnique(strList)) {
      throw new BadRequestException(
        `${field}: ${value} can only have unique values.`,
      );
    }

    return strList.map(i => +i);
  }
}
