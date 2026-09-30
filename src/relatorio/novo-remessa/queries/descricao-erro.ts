import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';

const STATUS_COM_ERRO = ['Estorno', 'Rejeitado'];

// Codes returned by the bank that are not in the CNAB table (OcorrenciaEnum) or whose
// description is worded differently for the user.
const DESCRICOES_CUSTOMIZADAS: Record<string, string> = {
  ANHO: 'Conta digital',
};

// Occurrence code returned by the bank (motivoStatusRemessa), only for rows shown as an error.
// It is turned into a description by getDescricaoErro, so the SQL does not need a lookup table.
export const buildCodigoErroSql = (statusCase: string) => `CASE
        WHEN ${statusCase} IN ('Estorno', 'Rejeitado')
          THEN NULLIF(TRIM(oph."motivoStatusRemessa"), '')
      END`;

// "codigos" may be an aggregated, comma separated list (rows grouped by date/consorcio/status).
export function getDescricaoErro(
  status: string | null | undefined,
  codigos: string | null | undefined,
): string | undefined {
  if (!status || !STATUS_COM_ERRO.includes(status) || !codigos) {
    return undefined;
  }

  const descricoes = new Set<string>();
  for (const codigo of String(codigos).split(',')) {
    const trimmed = codigo.trim();
    if (trimmed) {
      descricoes.add(
        DESCRICOES_CUSTOMIZADAS[trimmed]
          ?? OcorrenciaEnum[trimmed as keyof typeof OcorrenciaEnum]
          ?? `Código ${trimmed}`,
      );
    }
  }

  return descricoes.size ? Array.from(descricoes).join(' / ') : undefined;
}
