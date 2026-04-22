import { FinancialMovementExportFormat } from '../dtos/financial-movement-export-request.dto';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaSummaryDto } from '../dtos/relatorio-financial-and-movement.dto';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(value: number | string | null | undefined): string {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatFileDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildExportBaseFilename(
  format: FinancialMovementExportFormat,
  dataInicio: Date,
  dataFim: Date,
): string {
  return `financial-report-${formatFileDate(dataInicio)}-to-${formatFileDate(dataFim)}.${format}`;
}

export function maskCpfCnpj(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return String(value ?? '');
}

export function csvEscape(value: string | number | null | undefined): string {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function toExportRow(row: RelatorioFinancialMovementNovoRemessaData) {
  return {
    dataReferencia: row.dataReferencia ?? '',
    dataPagamento: row.dataPagamento ?? '',
    nomes: row.nomes ?? '',
    email: row.email ?? '',
    codBanco: String(row.codBanco ?? ''),
    nomeBanco: row.nomeBanco ?? '',
    cpfCnpj: maskCpfCnpj(row.cpfCnpj),
    consorcio: row.consorcio ?? '',
    valor: formatCurrency(row.valor),
    status: row.status ?? '',
  };
}

export function buildSummaryLines(summary: RelatorioFinancialMovementNovoRemessaSummaryDto): Array<[string, string]> {
  const totals: Array<[string, number]> = [
    ['Total Pago', Number(summary.valorPago ?? 0)],
    ['Total Estorno', Number(summary.valorEstornado ?? 0)],
    ['Total Rejeitado', Number(summary.valorRejeitado ?? 0)],
    ['Total Aguardando Pagamento', Number(summary.valorAguardandoPagamento ?? 0)],
    ['Total A Pagar', Number(summary.valorAPagar ?? 0)],
    ['Total OPs atrasadas', Number(summary.valorPendente ?? 0)],
    ['Total Pendencia Paga', Number(summary.valorPendenciaPaga ?? 0)],
  ];

  return [
    ...totals
      .filter(([, value]) => value > 0)
      .map(([label, value]) => [label, formatCurrency(value)] as [string, string]),
    ['Valor Total', formatCurrency(summary.valorTotal ?? 0)],
  ];
}

export function buildSelectedStatusLabels(args: {
  pago?: boolean;
  erro?: boolean;
  estorno?: boolean;
  rejeitado?: boolean;
  emProcessamento?: boolean;
  pendenciaPaga?: boolean;
  pendentes?: boolean;
  aPagar?: boolean;
}): string[] {
  const statuses: string[] = [];

  if (args.pago) statuses.push('Pago');
  if (args.erro) statuses.push('Pendência de Pagamento');
  if (args.estorno) statuses.push('Estorno');
  if (args.rejeitado) statuses.push('Rejeitado');
  if (args.emProcessamento) statuses.push('Aguardando Pagamento');
  if (args.pendenciaPaga) statuses.push('Pendencia Paga');
  if (args.pendentes) statuses.push('OPs atrasadas');
  if (args.aPagar) statuses.push('A Pagar');

  return statuses;
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
