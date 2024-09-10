import { BadRequestException, Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { isString } from 'class-validator';
import { isArrayUnique } from '../array-utils';
import { Enum } from '../enum';

/**
 * Valida se uma lista inserida contém apenas valores de outra lista
 * @param args.unique (opcional) Verifica se tem apenas valores únicos
 */
@Injectable()
export class ParseArrayPipe implements PipeTransform {
  /**
   *
   * @param args.transform default: true
   */
  constructor(
    private readonly args?: {
      /** Check if list items are valid enum  */
      enumType?: any;
      /** If must have unique values */
      compareList?: any[];
      unique?: boolean;
      transform?: boolean;
      /** Return empty list if not value given */
      transformOptional?: boolean;
      optional?: boolean;
    },
  ) {}

  transform(value: any | undefined, metadata: ArgumentMetadata): any {
    const enumType = this.args?.enumType;
    const list = this.args?.compareList;
    const field = metadata.data;
    const unique = this.args?.unique;
    let transform = this.args?.transform;
    if (transform === undefined) {
      transform = true;
    }

    if (this.args?.optional && value === undefined) {
      return this.args?.transformOptional ? [] : value;
    }

    if (!isString(value)) {
      throw new BadRequestException(`${field}: ${value} is not a valid list separated by comma.`);
    }

    const valueList = value.split(',');

    if (enumType && !valueList.every((e) => this.isEnumValue(e, enumType))) {
      throw new BadRequestException(`${field}: ${value} must have valid enum items (${Enum.getKeys(enumType).join(',')}).`);
    }
    if (list && !valueList.every((i) => list.includes(i))) {
      throw new BadRequestException(`${field}: ${value} must have valid items.`);
    }

    if (unique && !isArrayUnique(valueList)) {
      throw new BadRequestException(`${field}: ${value} can only have unique values.`);
    }
    const transformed = transform ? valueList : value;

    return transformed;
  }
  private isEnumValue(value: any, enumType: Record<string, any>): boolean {
    const enumValues = Object.values(enumType);
    return enumValues.includes(value);
  }
}
