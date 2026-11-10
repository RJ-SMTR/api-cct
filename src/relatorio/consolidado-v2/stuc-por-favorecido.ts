import { RelatorioConsolidadoNovoRemessaData, RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';

// STUC-Gratuidade no Consolidado: uma linha por favorecido com o total do periodo (decisao de Rayanne,
// 2026-11-10), em vez de uma linha por janela de pagamento. Homonimos com CPFs diferentes continuam
// em linhas separadas. O total geral nao muda: e' a soma das janelas.
export function agruparStucPorFavorecido(resultado: RelatorioConsolidadoNovoRemessaDto): RelatorioConsolidadoNovoRemessaDto {
  const grupos = new Map<string, { nomefavorecido: string; cpfCnpj?: string | null; centavos: number }>();

  for (const linha of resultado.data ?? []) {
    const chave = `${linha.nomefavorecido}|${linha.cpfCnpj ?? ''}`;
    const centavos = Math.round(Number(linha.valor) * 100);
    const atual = grupos.get(chave);
    if (atual) {
      atual.centavos += centavos;
    } else {
      grupos.set(chave, { nomefavorecido: linha.nomefavorecido, cpfCnpj: linha.cpfCnpj, centavos });
    }
  }

  const data = [...grupos.values()]
    .sort((a, b) => a.nomefavorecido.localeCompare(b.nomefavorecido))
    .map((grupo) => new RelatorioConsolidadoNovoRemessaData({ nomefavorecido: grupo.nomefavorecido, cpfCnpj: grupo.cpfCnpj, valor: grupo.centavos / 100 }));

  return new RelatorioConsolidadoNovoRemessaDto({ ...resultado, count: data.length, data });
}
