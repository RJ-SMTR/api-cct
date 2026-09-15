/**
 * Monta uma string CNAB 240 de RETORNO de pagamento (Caixa/104) para testes.
 * Linhas-template extraidas verbatim de um arquivo real; substitui apenas os
 * campos que os testes controlam. parseCnab240Pagamento aceita o resultado.
 */

export interface RetornoRegistroSpec {
  cpf: string; // so digitos
  valor: number; // em reais
  ocorrenciaDetalheA: string; // ex "00", "BD", "02", "AI"
  dataVencimento?: string; // DDMMYYYY (default: 08062026)
}
export interface RetornoLoteSpec {
  ocorrenciaHeaderLote?: string; // default "00"
  registros: RetornoRegistroSpec[];
}

const T_FILE_HEADER = "10400000         20054603700011044477301PP   0000   0406490006000710848 SECRETARIA MUNICIPAL DE TRANSPCAIXA                                   20806202602500100117405001600                                                      000            ";
const T_HEADER_LOTE = "10400011C2001030 20054603700011044477301000101      0406490006000710848 SECRETARIA MUNICIPAL DE TRANSP                                        R DONA MARIANA                00004ANDAR 7        RIO DE JANEIRO      22280020RJ        00        ";
const T_DETALHE_A = "1040001300001A0000181040022910008236719853 AMAURI CORDEIRO DE SOUZA      229909              08062026BRL000000000000000000000000449760000218637   01N0  0108062026000000000449760                                        00          000        ";
const T_DETALHE_B = "1040001300002B   100055032451720                              00000                                                  00000000  0806202600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 ";
const T_SEG_Z = "1040001300003Z                                                                E444BB0F4454776D47BBB3000                                                                                                                                         ";
const T_TRAILER_LOTE = "10400015         000005000000000000449760000000000000000000000000                                                                                                                                                                     00        ";
const T_FILE_TRAILER = "10499999         000002000087000000                                                                                                                                                                                                             ";

/** substitui `value` na linha a partir da posicao 1-indexed `pos` (nao muda o comprimento) */
function put(line: string, pos: number, value: string): string {
  const i = pos - 1;
  return line.slice(0, i) + value + line.slice(i + value.length);
}
function loteSeq(line: string, lote: number, seq: number): string {
  return put(put(line, 4, String(lote).padStart(4, "0")), 9, String(seq).padStart(5, "0"));
}

export function buildRetornoCnab(lotes: RetornoLoteSpec[]): string {
  const linhas: string[] = [T_FILE_HEADER];

  lotes.forEach((lote, li) => {
    const n = li + 1;
    let hl = loteSeq(T_HEADER_LOTE, n, 1);
    hl = put(hl, 231, (lote.ocorrenciaHeaderLote ?? "00").padEnd(10, " "));
    linhas.push(hl);

    let seq = 1;
    for (const r of lote.registros) {
      const cpf14 = r.cpf.replace(/\D/g, "").padStart(14, "0");
      const valor15 = String(Math.round(r.valor * 100)).padStart(15, "0");
      const dtVenc = (r.dataVencimento ?? "08062026").padStart(8, "0");

      let da = loteSeq(T_DETALHE_A, n, seq++);
      da = put(da, 94, dtVenc);
      da = put(da, 120, valor15);
      da = put(da, 231, r.ocorrenciaDetalheA.padEnd(10, " "));
      linhas.push(da);

      linhas.push(put(loteSeq(T_DETALHE_B, n, seq++), 19, cpf14));
      linhas.push(loteSeq(T_SEG_Z, n, seq++));
    }
    linhas.push(put(T_TRAILER_LOTE, 4, String(n).padStart(4, "0")));
  });

  linhas.push(T_FILE_TRAILER);
  return linhas.map((l) => l.padEnd(240, " ").slice(0, 240)).join("\r\n") + "\r\n";
}
