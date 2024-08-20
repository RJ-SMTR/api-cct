import { Injectable, PipeTransform, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { isDate, startOfDay } from 'date-fns';

@Injectable()
export class ParseDatePipe implements PipeTransform<string, string | Date> {
  constructor(
    private readonly args?: {
      regex?: RegExp;
      optional?: boolean;
      /** Validates only `yyyy-mm-dd` */
      dateOnly?: boolean;
      /** Transform into Date */
      transform?: boolean;
    },
  ) {}

  transform(value: string, metadata: ArgumentMetadata): string | Date {
    const field = metadata.data;
    const regex = this.args?.regex || /^\d{4}-\d{2}-\d{2}$/;

    if (isDate(value)) {
      return value;
    }
    
    if (!value) {
      if (this.args?.optional) {
        return value;
      }
      throw new BadRequestException(`${field}: Date is required.`);
    }

    if (!regex.test(value)) {
      throw new BadRequestException(`${field}: Invalid date format.`);
    }

    if (this.args?.dateOnly) {
      const dateValue = startOfDay(new Date(value));
      if (!isDate(dateValue)) {
        throw new BadRequestException(`${field}: Invalid date format.`);
      }
      return this.args?.transform ? dateValue : value;
    }

    return this.args?.transform ? new Date(value) : value;
  }
}
