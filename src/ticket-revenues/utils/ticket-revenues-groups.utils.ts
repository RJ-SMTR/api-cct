import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { TicketRevenuesGroupDto } from '../dtos/ticket-revenues-group.dto';
import { ITRCounts } from '../interfaces/tr-counts.interface';
import { TicketRevenueDTO } from '../dtos/ticket-revenue.dto';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';

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
  group: TicketRevenuesGroupDto,
  groupKey: keyof TicketRevenuesGroupDto,
  newItem: TicketRevenueDTO,
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
  group: TicketRevenuesGroupDto,
  groupPropName: keyof TicketRevenuesGroupDto,
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
  group: TicketRevenuesGroupDto,
  newItem: TicketRevenueDTO,
  detalhesA: DetalheA[],
) {
  group.count += 1;
  if (newItem.transactionValue) {
    const value = group.transactionValueSum + newItem.transactionValue;
    group.transactionValueSum = Number(value.toFixed(2));
  }
  group.paidValueSum += newItem.paidValue;
  const foundDetalhesA = detalhesA.filter(
    (i) =>
      i.itemTransacaoAgrupado.id ===
      newItem.arquivoPublicacao?.itemTransacao.itemTransacaoAgrupado.id,
  );
  const errors = DetalheA.getOcorrenciaErrors(foundDetalhesA);

  for (const [groupKey, groupValue] of Object.entries(group)) {
    if (groupKey === 'isPago') {
      if (!newItem?.arquivoPublicacao?.isPago && !newItem?.isPago) {
        group[groupKey] = false;
      }
    } else if (groupKey === 'errors') {
      if (!newItem.arquivoPublicacao?.isPago && !newItem?.isPago) {
        group[groupKey] = Ocorrencia.joinUniqueCode(group[groupKey], errors);
      }
    } else if (COUNTS_KEYS.includes(groupKey)) {
      const itemKey = groupKey.replace('Counts', '');
      appendCountsGroup(group, groupKey as any, newItem, itemKey);
    } else if (typeof groupValue === 'string') {
      group[groupKey] = newItem[groupKey];
    }
  }
}
