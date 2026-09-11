/**
 * Converte a string CNAB 240 de REMESSA (saida de RemessaService.gerarCnabText)
 * numa string de RETORNO para testes, injetando apenas o que o banco preencheria:
 *  - header arquivo: tipoArquivo (pos 143) 1 -> 2 (retorno);
 *  - header lote: ocorrencias (pos 231-240);
 *  - detalhe A: ocorrencias (pos 231-240), com override opcional por valor.
 *
 * Nao mexe em posicoes/valores. parseCnab240Pagamento aceita o resultado.
 */

export interface RemessaParaRetornoOpts {
  /** ocorrencia padrao para todo detalhe A (default '00') */
  ocorrenciaDetalheA?: string;
  /** ocorrencia do header lote (default '00') */
  ocorrenciaHeaderLote?: string;
  /** override por valor do lancamento em reais: { 4497.6: 'AI' } */
  ocorrenciaPorValor?: Record<number, string>;
}

/** substitui `value` a partir da posicao 1-indexed `pos`, sem mudar o comprimento */
function put(line: string, pos: number, value: string): string {
  const i = pos - 1;
  return line.slice(0, i) + value + line.slice(i + value.length);
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

export function remessaParaRetorno(remessa: string, opts: RemessaParaRetornoOpts = {}): string {
  const eol = remessa.includes('\r\n') ? '\r\n' : '\n';
  const linhas = remessa.split(/\r?\n/).filter((l) => l.length > 0);

  const ocA = (opts.ocorrenciaDetalheA ?? '00').padEnd(10, ' ');
  const ocHL = (opts.ocorrenciaHeaderLote ?? '00').padEnd(10, ' ');
  const porValor = Object.entries(opts.ocorrenciaPorValor ?? {}).map(([v, oc]) => ({
    valor: Number(v),
    oc: oc.padEnd(10, ' '),
  }));

  const out = linhas.map((linha) => {
    let l = linha.padEnd(240, ' ').slice(0, 240);
    const tipoRegistro = l[7]; // pos 8
    const segmento = l[13]; // pos 14

    if (tipoRegistro === '0') {
      l = put(l, 143, '2'); // tipoArquivo: retorno
    } else if (tipoRegistro === '1') {
      l = put(l, 231, ocHL);
    } else if (tipoRegistro === '3' && segmento === 'A') {
      const valor = Number(l.slice(119, 134)) / 100; // pos 120-134, 9(013)V99
      const override = porValor.find((p) => near(p.valor, valor));
      l = put(l, 231, override ? override.oc : ocA);
    }
    return l;
  });

  return out.join(eol) + eol;
}
