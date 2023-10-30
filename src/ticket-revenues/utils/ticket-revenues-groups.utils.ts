import { ITicketRevenue } from '../interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from '../interfaces/ticket-revenues-group.interface';

const countsKeys = [
  'transportTypeCounts',
  'directionIdCounts',
  'paymentMediaTypeCounts',
  'transactionTypeCounts',
  'transportIntegrationTypeCounts',
  'stopIdCounts',
  'stopLatCounts',
  'stopLonCounts',
];

export function sumOneCountsKey(
  group: ITicketRevenuesGroup,
  groupKey: keyof ITicketRevenuesGroup,
  countsKey: string | number,
  ignoreNullUndefinedValue = true,
) {
  if (
    (countsKey !== null && countsKey !== undefined) ||
    !ignoreNullUndefinedValue
  ) {
    const oldValue = group[groupKey][countsKey as any];
    if (oldValue === undefined) {
      group[groupKey][countsKey as any] = 0;
    } else {
      group[groupKey][countsKey as any] += 1;
    }
  }
}

export function appendItem(
  group: ITicketRevenuesGroup,
  item: ITicketRevenue,
  ignoreNullUndefinedValue = true,
) {
  for (const [key, value] of Object.entries(group)) {
    if (countsKeys.includes(key)) {
      const itemKey = key.replace('Counts', '');
      sumOneCountsKey(
        group,
        key as any,
        item[itemKey] as any,
        ignoreNullUndefinedValue,
      );
    } else if (typeof value === 'string') {
      group[key] = item[key];
    } else if (typeof value === 'number') {
      group.count += 1;
      if (item.transactionValue) {
        group.transactionValueSum = Number(
          (group.transactionValueSum + item.transactionValue).toFixed(2),
        );
      }
    }
  }
}
