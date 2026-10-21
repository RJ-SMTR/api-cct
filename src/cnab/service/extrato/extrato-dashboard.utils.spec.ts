import { montarResumoExtrato, sqlContaExtrato } from './extrato-dashboard.utils';

describe('extrato-dashboard.utils', () => {
  it('mostra todas as contas, mesmo zeradas, e soma entradas e saídas por conta', () => {
    const r = montarResumoExtrato([
      { conta: 'cett', dia: '2026-10-01', tipo: 'C', descricao: 'PIX RECEBIDO', qtd: 2, valor: '100.10' },
      { conta: 'cett', dia: '2026-10-01', tipo: 'D', descricao: 'ENVIO DE TED', qtd: 1, valor: '30.05' },
      { conta: 'cett', dia: '2026-10-02', tipo: 'C', descricao: 'PIX RECEBIDO', qtd: '1', valor: '50' },
    ]);
    expect(r.map((c) => c.conta)).toEqual(['bilhetagem', 'cett', 'rotativo', 'outras']);
    const cett = r.find((c) => c.conta === 'cett');
    expect(cett.entradas).toEqual({ qtd: 3, valor: 150.1 });
    expect(cett.saidas).toEqual({ qtd: 1, valor: 30.05 });
    expect(cett.resultado).toBe(120.05);
    expect(cett.porDia).toEqual([
      { data: '2026-10-01', entradas: 100.1, saidas: 30.05 },
      { data: '2026-10-02', entradas: 50, saidas: 0 },
    ]);
    expect(cett.porHistorico[0]).toMatchObject({ descricao: 'PIX RECEBIDO', tipo: 'C', qtd: 3, valor: 150.1 });
    expect(r.find((c) => c.conta === 'bilhetagem').entradas).toEqual({ qtd: 0, valor: 0 });
  });

  it('classifica as contas pelo número sem zeros à esquerda', () => {
    const sql = sqlContaExtrato('x');
    expect(sql).toContain("ltrim(x.conta, '0') IN ('575278026', '6000071083', '600071083') THEN 'cett'");
    expect(sql).toContain("ELSE 'outras' END");
  });
});
