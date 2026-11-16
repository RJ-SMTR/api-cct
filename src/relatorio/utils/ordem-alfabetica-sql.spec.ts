import { chaveOrdemAlfabeticaSql } from './ordem-alfabetica-sql';

// A chave nao depende de collation do banco (ICU pode nao existir em HML/producao): maiusculas,
// sem acento, comparada byte a byte (COLLATE "C"), onde o espaco vem antes das letras.
describe('chaveOrdemAlfabeticaSql', () => {
  it('compara a expressao em maiusculas, sem acento e com COLLATE "C"', () => {
    const sql = chaveOrdemAlfabeticaSql('g.nomes');

    expect(sql).toMatch(/^UPPER\(TRANSLATE\(COALESCE\(g\.nomes, ''\), '[^']+', '[^']+'\)\) COLLATE "C"$/);
  });

  it('troca cada letra acentuada pela letra sem acento, na mesma posicao', () => {
    const [, com, sem] = /TRANSLATE\(COALESCE\(x, ''\), '([^']+)', '([^']+)'\)/.exec(chaveOrdemAlfabeticaSql('x')) ?? [];

    expect(com.length).toBe(sem.length);
    expect(sem).toMatch(/^[A-Za-z]+$/);
    for (const [acentuada, base] of [['á', 'a'], ['É', 'E'], ['ç', 'c'], ['Õ', 'O'], ['ü', 'u']]) {
      expect(sem[com.indexOf(acentuada)]).toBe(base);
    }
  });
});
