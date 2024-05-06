import { ApiParamOptions } from '@nestjs/swagger';
import { WeekdayEnum } from '../enums/weekday.enum';
import { DescriptionApiParam } from './description-api-param';
import { TimeIntervalEnum } from '../enums/time-interval.enum';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const DateApiParams = {
  startDate: {
    name: 'startDate',
    required: false,
    description: DescriptionApiParam({
      hours: '00:00',
    }),
  } as ApiParamOptions,

  endDate: {
    name: 'endDate',
    required: false,
    description: DescriptionApiParam({ hours: '23:59:59.999' }),
  } as ApiParamOptions,

  getEndDate: (required = false) =>
    ({
      name: 'endDate',
      required: required,
      description: DescriptionApiParam({ hours: '23:59:59.999' }),
    } as ApiParamOptions),

  timeInterval: {
    name: 'timeInterval',
    required: false,
    description: DescriptionApiParam({
      default: TimeIntervalEnum.LAST_MONTH,
    }),
    example: TimeIntervalEnum.LAST_MONTH,
    enum: TimeIntervalEnum,
  } as ApiParamOptions,

  getTimeInterval: (enumType: any, defaultEnumValue: any, required = false) =>
    ({
      name: 'timeInterval',
      required: required,
      description: DescriptionApiParam({
        default: defaultEnumValue,
      }),
      example: defaultEnumValue,
      enum: enumType,
    } as ApiParamOptions),

  ignorePreviousWeek: {
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: DescriptionApiParam({ default: true }),
  } as ApiParamOptions,

  startWeekday: (defaultValue: WeekdayEnum) =>
    ({
      name: 'startWeekday',
      required: false,
      description: DescriptionApiParam({
        default: defaultValue,
        min: 0,
        max: 6,
        meaning: `0 = ${WeekdayEnum._0_SUNDAY}, 6 = ${WeekdayEnum._6_SATURNDAY}`,
      }),
      enum: WeekdayEnum,
    } as ApiParamOptions),
};
