import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { ITicketRevenue } from '../interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from '../interfaces/ticket-revenues-group.interface';
import { ITRCounts } from '../interfaces/tr-counts.interface';
import { getDateNthWeek } from 'src/utils/date-utils';
import { WeekdayEnum } from 'src/utils/enums/weekday.enum';

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
  detalhesA: DetalheA[],
) {
  group.count += 1;
  if (newItem.transactionValue) {
    const value = group.transactionValueSum + newItem.transactionValue;
    group.transactionValueSum = Number(value.toFixed(2));
  }
  const nthWeek = getDateNthWeek(
    new Date(newItem.date),
    WeekdayEnum._4_THURSDAY,
  );
  if (newItem.paidValue && !group.aux_nthWeeks.includes(nthWeek)) {
    const value = group.paidValueSum + newItem.paidValue;
    group.paidValueSum = Number(value.toFixed(2));
    group.aux_nthWeeks.push(nthWeek);
  }
  const foundDetalhesA = detalhesA.filter(
    (i) =>
      i.itemTransacaoAgrupado.id ===
      newItem.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
  );
  const errors = foundDetalhesA.reduce(
    (l, i) => [
      ...l,
      ...i.ocorrencias
        .filter((j) => !['00', 'BD'].includes(j.code))
        .map((j) => j.message),
    ],
    [],
  );

  for (const [groupKey, groupValue] of Object.entries(group)) {
    if (groupKey === 'isPago') {
      if (!newItem?.arquivoPublicacao?.isPago) {
        group[groupKey] = false;
      }
    } else if (groupKey === 'errors') {
      if (!newItem.arquivoPublicacao?.isPago) {
        group[groupKey] = [...new Set([...group[groupKey], ...errors])];
      }
    } else if (COUNTS_KEYS.includes(groupKey)) {
      const itemKey = groupKey.replace('Counts', '');
      appendCountsGroup(group, groupKey as any, newItem, itemKey);
    } else if (typeof groupValue === 'string') {
      group[groupKey] = newItem[groupKey];
    }
  }
}
