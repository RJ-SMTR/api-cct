import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { FinancialMovementQueryDto } from '../../dtos/pay-and-pending-query.dto';
import { BasePagamentoCursor } from '../base/base-pagamento.repository';
import type { FinancialMovementV2Filter } from './financial-movement-v2-summary.service';

// Same boolean-flag -> StatusPagamento[] mapping the legacy service does in getStatusParaFiltro
// (relatorio-novo-remessa-financial-movement.service.ts) - reused here so the v2 routes accept
// the exact same request shape (FinancialMovementQueryDto/FinancialMovementExportRequestDto,
// T10 Constraints: "mesmos DTOs de request... se os campos nao mudaram").
export function mapStatusesFromQuery(query: Pick<FinancialMovementQueryDto, 'pago' | 'aPagar' | 'emProcessamento' | 'erro' | 'estorno' | 'rejeitado' | 'pendenciaPaga' | 'pendentes'>): StatusPagamento[] | undefined {
  const statuses: StatusPagamento[] = [];
  if (query.pago) statuses.push(StatusPagamento.PAGO);
  if (query.aPagar) statuses.push(StatusPagamento.A_PAGAR);
  if (query.emProcessamento) statuses.push(StatusPagamento.AGUARDANDO_PAGAMENTO);
  if (query.erro) statuses.push(StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO);
  if (query.estorno) statuses.push(StatusPagamento.ERRO_ESTORNO);
  if (query.rejeitado) statuses.push(StatusPagamento.ERRO_REJEITADO);
  if (query.pendenciaPaga) statuses.push(StatusPagamento.PENDENCIA_PAGA);
  if (query.pendentes) statuses.push(StatusPagamento.PENDENTES);
  return statuses.length ? [...new Set(statuses)] : undefined;
}

// Maps the existing request DTO (FinancialMovementQueryDto, shared with the legacy routes - no
// field changed, see T10 Constraints) into the filter shape the v2 sources (T1-T8) expect.
// "todosVanzeiros" is deliberately NOT forwarded: resolveConsorcioFilter (base-pagamento.repository.ts,
// T3) already normalizes "no favorecido selected" to the same behaviour as todosVanzeiros=true
// (ADR 0014) by itself, from userIds/consorcioNome/todosConsorcios alone.
export function mapQueryToFinancialMovementV2Filter(
  query: FinancialMovementQueryDto,
): FinancialMovementV2Filter {
  return {
    dataInicio: new Date(query.dataInicio),
    dataFim: new Date(query.dataFim),
    statuses: mapStatusesFromQuery(query),
    valorMin: query.valorMin,
    valorMax: query.valorMax,
    userIds: query.userIds,
    consorcioNome: query.consorcioNome,
    todosConsorcios: query.todosConsorcios,
    eleicao: query.eleicao,
    stucGratuidade: query.stucGratuidade,
    page: query.page,
    pageSize: query.pageSize,
    cursorDataReferencia: query.cursorDataReferencia,
    cursorNome: query.cursorNome,
    cursorStatus: query.cursorStatus,
    cursorCpfCnpj: query.cursorCpfCnpj,
    cursorNomeConsorcio: query.cursorNomeConsorcio,
  };
}

// Builds the T4 keyset cursor (BasePagamentoRepository.findGroupedRowsPage) from the request
// DTO's cursor* fields. KNOWN SHAPE MISMATCH (documented, not silently dropped): the legacy
// cursor (RelatorioFinancialMovementNovoRemessaCursor) and the DTO built for it carry
// cursorCodBanco/cursorDataPagamento/cursorEmail/cursorCodigoErro (Guardador tie-breakers for
// the OLD query shape) but no "cursorValor" - while BasePagamentoCursor (T4/ADR 0002) uses
// dataReferencia/nomes/cpfCnpj/nomeConsorcio/status/valor as its tuple. There is no DTO field
// for the "valor" tie-breaker. Extending the DTO is out of scope for T10 (Constraints: same
// request DTOs, "se os campos nao mudaram" - this is the one case where the v2 source's cursor
// genuinely needs a field the legacy DTO never had). Left as-is (valor tie-breaker always null
// here): a page boundary that lands on two rows sharing dataReferencia/nomes/cpfCnpj/
// nomeConsorcio/status but different valor could in theory skip/repeat a row - flagged as a
// follow-up for whoever extends the DTO before the v2 routes carry real pagination traffic.
export function resolveCursorFromQuery(query: FinancialMovementV2Filter): BasePagamentoCursor | undefined {
  const hasCursor = Boolean(query.cursorDataReferencia) && Boolean(query.cursorNome) && Boolean(query.cursorStatus) && Boolean(query.cursorCpfCnpj);
  if (!hasCursor) return undefined;
  return {
    dataReferencia: query.cursorDataReferencia ?? null,
    nomes: query.cursorNome ?? null,
    cpfCnpj: query.cursorCpfCnpj ?? null,
    nomeConsorcio: query.cursorNomeConsorcio ?? null,
    status: query.cursorStatus ?? null,
    valor: null,
  };
}
