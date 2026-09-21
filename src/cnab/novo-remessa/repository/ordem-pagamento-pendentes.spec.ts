import { OrdemPagamentoRepository } from './ordem-pagamento.repository';
import { Pagador } from '../../entity/pagamento/pagador.entity';

describe('Consortium pending-payment grouping', () => {
  it.each([
    { idsFavorecidos: undefined, filter: null },
    { idsFavorecidos: [], filter: null },
    { idsFavorecidos: ['255', '318'], filter: '{255,318}' },
  ])('calls the pending procedure with beneficiary filter $filter', async ({ idsFavorecidos, filter }) => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = new OrdemPagamentoRepository({ query } as any, {} as any);

    await repository.agruparOrdensPendentesConsorcio(
      new Date('2026-07-01'), new Date('2026-09-07'), new Date('2026-09-11'),
      { id: 1 } as Pagador, idsFavorecidos,
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'CALL P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES($1, $2, $3, $4, $5)',
      ['2026-07-01 00:00:00', '2026-09-07 23:59:59', '2026-09-11', 1, filter],
    );
  });
});
