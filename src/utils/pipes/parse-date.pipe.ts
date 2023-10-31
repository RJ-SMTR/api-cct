import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseDatePipe implements PipeTransform<string, string> {
  constructor(
    private readonly dateFormatRegex?: RegExp,
    private readonly optional: boolean = true,
  ) {}

  transform(value: string): string {
    if (!value) {
      if (this.optional) {
        return value;
      }
      throw new BadRequestException('Date is required.');
    }

    if (!this.dateFormatRegex || !this.dateFormatRegex.test(value)) {
      throw new BadRequestException('Invalid date format.');
    }

    return value;
  }
}
