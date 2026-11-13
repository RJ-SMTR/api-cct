import { PagamentoGuardadorService } from './pagamento-guardador.service';
import * as dateUtils from 'src/utils/date-utils';

describe('PagamentoGuardadorService.listarPreparadosAtual', () => {
  const hoje = new Date('2026-11-13T03:00:00.000Z');

  afterEach(() => jest.restoreAllMocks());

  it('lista os preparados de hoje sem filtro de período nem paginação (a lista sobrevive a recarregar a tela)', async () => {
    jest.spyOn(dateUtils, 'getInicioDoDiaBrasilia').mockReturnValue(hoje);
    const preparados = [{ detalheAId: 1, nomeConsorcio: 'Guardador', nomeUsuario: 'A', valorAgrupado: 10, valorBi: 10 }];
    const listarPreparados = jest.fn().mockResolvedValue(preparados);
    const service = new PagamentoGuardadorService({} as any, {} as any, { listarPreparados } as any, {} as any, {} as any);

    await expect(service.listarPreparadosAtual()).resolves.toBe(preparados);
    expect(listarPreparados).toHaveBeenCalledWith(hoje);
  });
});
