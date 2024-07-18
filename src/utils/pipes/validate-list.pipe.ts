import {
  BadRequestException,
  Injectable,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';
import { isString } from 'class-validator';
import { isArrayUnique } from '../array-utils';

/**
 * Valida se uma lista inserida contém apenas valores de outra lista
 * @param args.unique (opcional) Verifica se tem apenas valores únicos
 */
@Injectable()
export class ValidateListPipe implements PipeTransform {
  constructor(
    private readonly list: any[],
    private readonly args?: {
      /** If must have unique values */
      unique?: boolean;
      transform?: boolean;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): any {
    const list = this.list;
    const field = metadata.data;
    const unique = this.args?.unique;
    const transform = this.args?.transform;

    if (!(isString(value) && value.split(',').every((i) => list.includes(i)))) {
      throw new BadRequestException(
        `${field}: ${value} is not a valid list separated by comma.`,
      );
    }
    if (unique && !isArrayUnique(list)) {
      throw new BadRequestException(
        `${field}: ${value} can only have unique values.`,
        );
      }
      const transformed = transform ? value.split(',') : value;
      
    return transformed;
  }
}
