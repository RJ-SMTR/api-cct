import { DetalheARepository } from './detalhe-a.repository';

describe('DetalheARepository.getDetalheARetorno', () => {
  const executar = async (contaPagador?: string) => {
    const queryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    const repo = new DetalheARepository(undefined as any, { createQueryRunner: () => queryRunner } as any);
    await repo.getDetalheARetorno('12345678901', 10, new Date('2026-10-16'), contaPagador);
    return queryRunner.query.mock.calls[0];
  };

  it('casa também a remessa de gratuidade (conta CETT), cujas ordens apontam por ordemPagamentoAgrupadoGratuidadeId', async () => {
    const [sql, params] = await executar();
    expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    expect(params).toEqual(['12345678901', 10, new Date('2026-10-16'), null]);
  });

  it('continua casando consórcio e guardador (normal e pendente)', async () => {
    const [sql] = await executar();
    expect(sql).toContain('op."ordemPagamentoAgrupadoId" = opa.id');
    expect(sql).toContain('og."ordemPagamentoAgrupadoId" = opa.id');
    expect(sql).toContain('filha."ordemPagamentoAgrupadoId" = opa.id');
  });
  it('filtra pela conta do pagador do lote do retorno, sem zeros à esquerda', async () => {
    const [sql, params] = await executar('000600071083');
    expect(params[3]).toBe('600071083');
    expect(sql).toContain('pg.id = opa."pagadorId"');
  });
});
