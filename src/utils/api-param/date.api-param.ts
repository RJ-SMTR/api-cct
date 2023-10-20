import { ApiParamOptions } from '@nestjs/swagger';
import { WeekdayEnum } from '../enums/weekday.enum';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const DateApiParams = {
  startDate: {
    name: 'startDate',
    required: false,
    description: 'hours: 00:00',
  } as ApiParamOptions,
  endDate: {
    name: 'endDate',
    required: false,
    description: 'hours: 23:59:59.999',
  } as ApiParamOptions,
  previousDays: {
    name: 'previousDays',
    required: false,
    description: `**default:** 30, **min:** 0`,
  } as ApiParamOptions,
  ignorePreviousWeek: {
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: '**default:** `true`',
  } as ApiParamOptions,
  startWeekday: (defaultValue: WeekdayEnum) =>
    ({
      name: 'startWeekday',
      required: false,
      description:
        `**default:** ${defaultValue}, ` +
        `**min:** 0, **max:** 6, **meaning:** 0 = monday, 6 = sunday`,
    } as ApiParamOptions),
};
