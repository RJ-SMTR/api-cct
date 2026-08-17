import { DataSource } from 'typeorm';
import { RelatorioGuardadorConsolidadoRepository } from './relatorio-guardador-consolidado.repository';

describe('RelatorioGuardadorConsolidadoRepository', () => {
  let repository: RelatorioGuardadorConsolidadoRepository;

  beforeEach(() => {
    repository = new RelatorioGuardadorConsolidadoRepository({
      query: jest.fn(),
    } as unknown as DataSource);
  });

  it('should prioritize estornado over pago false when building the status clause', () => {
    const params: any[] = [];

    const result = (repository as any).buildStatusClause(
      {
        pago: false,
        emProcessamento: undefined,
        rejeitado: undefined,
        estornado: true,
      },
      params,
      5,
    );

    expect(result).toEqual({
      clause: ' AND  oph."statusRemessa" = 4 AND oph."motivoStatusRemessa" = $5',
      nextIdx: 6,
    });
    expect(params).toEqual(['02']);
  });

  it('should keep the generic statusRemessa 4 filter when pago is false without a specific reason', () => {
    const params: any[] = [];

    const result = (repository as any).buildStatusClause(
      {
        pago: false,
        emProcessamento: undefined,
        rejeitado: undefined,
        estornado: undefined,
      },
      params,
      3,
    );

    expect(result).toEqual({
      clause: ' AND oph."statusRemessa" = $3',
      nextIdx: 4,
    });
    expect(params).toEqual([4]);
  });
});
