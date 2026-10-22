import { PagamentosIndevidosGuardadoresService } from './pagamentos-indevidos-guardadores.service';

describe('PagamentosIndevidosGuardadoresService.porUsuario', () => {
  const totais = { quantidade: 1, devendo: 1, valorIndevido: '877.80', valorDebitado: '238.00', saldoDevedor: '639.80' };
  const itens = [{ id: 3099, userId: 2456, guardador: 'CELSO DE CASTRO BANDEIRA', saldoDevedor: '639.80', situacao: 'devendo' }];

  const build = () => {
    const query = jest.fn().mockResolvedValueOnce([totais]).mockResolvedValueOnce(itens);
    const service = new PagamentosIndevidosGuardadoresService({ query } as any);
    return { service, query };
  };

  it('devolve os totais e as linhas do guardador', async () => {
    const { service } = build();

    await expect(service.porUsuario(2456)).resolves.toEqual({ totais, itens });
  });

  it('filtra pelo id do usuário (parâmetro, nunca concatenado) nas duas consultas', async () => {
    const { service, query } = build();

    await service.porUsuario(2456);

    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('user_id = $1');
      expect(sql).not.toContain('2456');
      expect(params).toEqual([2456]);
    }
  });

  it('só considera guardadores (permitCode de até 4 caracteres) e calcula o indevido linha a linha', async () => {
    const { service, query } = build();

    await service.porUsuario(2456);

    const [sql] = query.mock.calls[0];
    expect(sql).toContain('length(u."permitCode") <= 4');
    expect(sql).toContain('GREATEST(COALESCE(pi."valorPago", 0) - COALESCE(pi."valorPagar", 0), 0)');
  });
});
