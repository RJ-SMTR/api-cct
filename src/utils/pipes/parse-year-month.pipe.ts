import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseYearMonthPipe implements PipeTransform<string, string> {
  private readonly dateFormatRegex = new RegExp(/^\d{4}-\d{2}$/);

  constructor(private readonly optional: boolean = true) {}

  transform(value: string): string {
    if (!value) {
      if (this.optional) {
        return value;
      }
      throw new BadRequestException(
        'Formato inválido. O formato year-month deve ser yyyy-mm.',
      );
    }

    if (!this.dateFormatRegex.test(value)) {
      throw new BadRequestException(
        'Formato inválido. O formato year-month deve ser yyyy-mm.',
      );
    }
    const year: number = +value.substring(0, 4);
    const month: number = +value.substring(5, 7);
    if (year < 0 || month < 1 || month > 12) {
      throw new BadRequestException(
        'Formato inválido. O formato year-month deve ser yyyy-mm.',
      );
    }
    return value;
  }
}
