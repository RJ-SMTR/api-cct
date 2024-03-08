import { ITicketRevenue } from '../interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from '../interfaces/ticket-revenues-group.interface';
import { ITRCounts } from '../interfaces/tr-counts.interface';

const COUNTS_KEYS = [
  'transportTypeCounts',
  'directionIdCounts',
  'paymentMediaTypeCounts',
  'transactionTypeCounts',
  'transportIntegrationTypeCounts',
  'stopIdCounts',
  'stopLatCounts',
  'stopLonCounts',
];

export function appendCountsGroup(
  group: ITicketRevenuesGroup,
  groupKey: keyof ITicketRevenuesGroup,
  newItem: ITicketRevenue,
  itemKey: string,
) {
  const IGNORE_NULL_UNDEFINED = true;
  const countsKey = newItem[itemKey];
  if (
    (countsKey !== null && countsKey !== undefined) ||
    !IGNORE_NULL_UNDEFINED
  ) {
    const oldItem = group[groupKey][countsKey] as ITRCounts;
    if (oldItem === undefined) {
      (group[groupKey][countsKey] as ITRCounts) = {
        count: 1,
        transactionValue: newItem?.transactionValue || 0,
      };
    } else {
      (group[groupKey][countsKey] as ITRCounts) = {
        count: oldItem.count + 1,
        transactionValue: Number(
          (oldItem.transactionValue + (newItem?.transactionValue || 0)).toFixed(
            2,
          ),
        ),
      };
    }
  }
}

export function appendCountsValue(
  group: ITicketRevenuesGroup,
  groupPropName: keyof ITicketRevenuesGroup,
  newItemKey: string | number,
  ignoreNullUndefinedValue = true,
) {
  if (
    (newItemKey !== null && newItemKey !== undefined) ||
    !ignoreNullUndefinedValue
  ) {
    const oldValue = group[groupPropName][newItemKey as any];
    if (oldValue === undefined) {
      group[groupPropName][newItemKey as any] = 1;
    } else {
      group[groupPropName][newItemKey as any] += 1;
    }
  }
}

export function appendItem(
  group: ITicketRevenuesGroup,
  newItem: ITicketRevenue,
) {
  group.count += 1;
  if (newItem.transactionValue) {
    group.transactionValueSum = Number(
      (group.transactionValueSum + newItem.transactionValue).toFixed(2),
    );
  }

  for (const [groupPropName, groupPropValue] of Object.entries(group)) {
    if (COUNTS_KEYS.includes(groupPropName)) {
      const itemKey = groupPropName.replace('Counts', '');
      appendCountsGroup(group, groupPropName as any, newItem, itemKey);
    } else if (typeof groupPropValue === 'string') {
      group[groupPropName] = newItem[groupPropName];
    }
  }
}
