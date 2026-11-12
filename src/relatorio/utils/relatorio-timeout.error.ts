// ADR 0023: a report query cancelled by Postgres statement_timeout (SQLSTATE 57014). Controllers map it to
// HTTP 504 with RELATORIO_TIMEOUT_MESSAGE instead of the generic 400.
export const POSTGRES_QUERY_CANCELED = '57014';

export const RELATORIO_TIMEOUT_MESSAGE = 'A consulta demorou mais de 2 minutos; reduza o período';

export class RelatorioTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(RELATORIO_TIMEOUT_MESSAGE);
    this.name = 'RelatorioTimeoutError';
  }
}

export function isQueryCanceledError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === POSTGRES_QUERY_CANCELED;
}
