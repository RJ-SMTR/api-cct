// Accented letters and their base letters, position by position (TRANSLATE needs the same length).
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';

/**
 * Sort key for a name in the reports, matching the Consolidado (localeCompare 'pt-BR'): the space
 * counts (ANA CRISTINA before ANACLETO) and accents/case do not push a name to the end. The
 * database default collation (en_US) ignores spaces, which put the Movimentacao Financeira in a
 * different order than the Consolidado. Built without depending on an ICU collation (it may not
 * exist in every environment): upper case, no accents, compared byte by byte (COLLATE "C"), where
 * the space comes before the letters. Checked against the 3162 real names of the local database:
 * the same order as localeCompare 'pt-BR'.
 */
export function chaveOrdemAlfabeticaSql(expressao: string): string {
  return `UPPER(TRANSLATE(COALESCE(${expressao}, ''), '${COM_ACENTO}', '${SEM_ACENTO}')) COLLATE "C"`;
}
