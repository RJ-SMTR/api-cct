import { ApiParamOptions } from '@nestjs/swagger';
import { WeekdayEnum } from '../enums/weekday.enum';
import { ApiDescription } from './description-api-param';
import { TimeIntervalEnum } from '../enums/time-interval.enum';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const DateApiParams = {
  yearMonth: {
    name: 'yearMonth',
    required: false,
    example: '2024-01',
  } as ApiParamOptions,

  startDate: {
    name: 'startDate',
    required: false,
    description: ApiDescription({
      hours: '00:00',
    }),
  } as ApiParamOptions,

  endDate: {
    name: 'endDate',
    required: false,
    description: ApiDescription({ hours: '23:59:59.999' }),
  } as ApiParamOptions,

  getEndDate: (required = false) =>
    ({
      name: 'endDate',
      required: required,
      description: ApiDescription({ hours: '23:59:59.999' }),
    } as ApiParamOptions),

  timeInterval: {
    name: 'timeInterval',
    required: false,
    description: ApiDescription({
      default: TimeIntervalEnum.LAST_MONTH,
    }),
    example: TimeIntervalEnum.LAST_MONTH,
    enum: TimeIntervalEnum,
  } as ApiParamOptions,

  getTimeInterval: (enumType: any, defaultEnumValue: any, required = false) =>
    ({
      name: 'timeInterval',
      required: required,
      description: ApiDescription({
        default: defaultEnumValue,
        about:
          '`lastDay`: recebe o dia e retorna os dias anteriores desse dia. <br>' +
          '`lastMonth`: recebe uma sexta-feira e retorna os dias de qui-qua dessa semana de pagamento.',
      }),
      example: defaultEnumValue,
      enum: enumType,
    } as ApiParamOptions),

  ignorePreviousWeek: {
    name: 'ignorePreviousWeek',
    type: Boolean,
    required: false,
    description: ApiDescription({ default: true }),
  } as ApiParamOptions,

  startWeekday: (defaultValue: WeekdayEnum) =>
    ({
      name: 'startWeekday',
      required: false,
      description: ApiDescription({
        default: defaultValue,
        min: 0,
        max: 6,
        meaning: `0 = ${WeekdayEnum._0_SUNDAY}, 6 = ${WeekdayEnum._6_SATURNDAY}`,
      }),
      enum: WeekdayEnum,
    } as ApiParamOptions),
};
