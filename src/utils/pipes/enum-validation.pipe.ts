import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class EnumValidationPipe implements PipeTransform<string, string> {
  constructor(
    private enumType: any,
    private match: 'key' | 'value' | 'both' = 'both',
  ) {}

  transform(value: string): string {
    if (value === undefined) {
      return value;
    }
    if (!this.isEnumValue(value, this.enumType, this.match)) {
      throw new BadRequestException(`The value '${value}' is invalid`);
    }
    return value;
  }

  private isEnumValue(
    value: string,
    enumType: any,
    match: 'key' | 'value' | 'both',
  ): boolean {
    const enumValues = Object.values(enumType);

    if (match === 'key') {
      return enumValues.includes(value);
    } else if (match === 'value') {
      return Object.keys(enumType).includes(value);
    } else if (match === 'both') {
      return (
        enumValues.includes(value) || Object.keys(enumType).includes(value)
      );
    }

    return false;
  }
}
