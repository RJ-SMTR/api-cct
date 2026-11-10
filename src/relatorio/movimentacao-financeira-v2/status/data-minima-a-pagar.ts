// Mesma regra de getDataMinima do legado (RelatorioNovoRemessaFinancialMovementService e
// RelatorioNovoRemessaConsolidadoRepository): A Pagar nunca enviado so aparece a partir do inicio
// do ciclo atual de pagamento.
export function getDataMinimaAPagar(hoje = new Date()): Date {
  const dia = hoje.getDay();
  const data = new Date(hoje);
  data.setHours(0, 0, 0, 0);

  const diasDesdeOInicio: Record<number, number> = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0 };
  data.setDate(data.getDate() - diasDesdeOInicio[dia]);
  return data;
}

export function resolveInicioAPagar(dataInicio: Date, hoje = new Date()): Date {
  const dataMinima = getDataMinimaAPagar(hoje);
  return dataMinima.getTime() >= dataInicio.getTime() ? dataMinima : dataInicio;
}
