import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { isDate, startOfDay } from 'date-fns';

@Injectable()
export class ParseDatePipe implements PipeTransform<string, string | Date> {
  constructor(
    private readonly args?: {
      regex?: RegExp;
      optional?: boolean;
      /** Validates only `yyyy-mm-dd` */
      dateOnly?: boolean;
    },
  ) {}

  transform(value: string): string | Date {
    const regex = this.args?.regex || /^\d{4}-\d{2}-\d{2}$/;

    if (!value) {
      if (this.args?.optional) {
        return value;
      }
      throw new BadRequestException('Date is required.');
    }

    if (!regex.test(value)) {
      throw new BadRequestException('Invalid date format.');
    }

    if (this.args?.dateOnly) {
      const dateValue = startOfDay(new Date(value));
      if (!isDate(dateValue)) {
        throw new BadRequestException('Invalid date format.');
      }
      return dateValue;
    }

    return value;
  }
}
