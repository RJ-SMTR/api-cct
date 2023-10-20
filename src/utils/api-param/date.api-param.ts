import { ApiParamOptions } from '@nestjs/swagger';
import { WeekdayEnum } from '../enums/weekday.enum';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const DateApiParams = {
  startDate: {
    name: 'startDate',
    required: false,
    description: '_Hours_ : 00:00',
  } as ApiParamOptions,
  endDate: {
    name: 'endDate',
    required: false,
    description: '_Hours_ : 23:59:59.999',
  } as ApiParamOptions,
  previousDays: {
    name: 'previousDays',
    required: false,
    description: '_Default_ : 30' + '\n\n_Min_ : 0',
  } as ApiParamOptions,
  ignorePreviousWeek: {
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: '_Default_ : true',
  } as ApiParamOptions,
  startWeekday: (defaultValue: WeekdayEnum) =>
    ({
      name: 'startWeekday',
      required: false,
      description:
        `_Default_ : ${defaultValue}` +
        '\n\n_Min_ : 0' +
        '\n\n_Max_ : 6' +
        '\n\n_Meaning_ : 0 = monday, 6 = sunday',
      enum: WeekdayEnum,
    } as ApiParamOptions),
};
