import { RemessaService } from './remessa.service';
import { DetalhesToCnab } from '../convertTo/detalhes-to-cnab.convert';
import { CnabHeaderLote104PgtoDTO } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { stringifyCnab104File } from 'src/cnab/utils/cnab/cnab-104-utils';

jest.mock('src/cnab/utils/cnab/cnab-104-utils', () => ({ stringifyCnab104File: jest.fn() }));

/**
 * Regressao: o arquivo da remessa de pendentes de guardadores (21/10/2026) saiu com 22 pagamentos para 18 gerados porque cada
 * lote nao-TED recebia TODOS os pagamentos de banco 104 (poupanca "05" e conta corrente "01" no mesmo arquivo repetiam a Caixa).
 */
describe('RemessaService.gerarListaCnab - distribuicao dos pagamentos nos lotes', () => {
  let service: RemessaService;
  let headerLoteService: { findAll: jest.Mock };
  let detalheAService: { getDetalheAHeaderLote: jest.Mock };

  const lote = (id: number, formaLancamento: string) => ({ id, formaLancamento });
  const detalheA = (id: number) => ({ id, nsr: 1 });

  const gerar = async () => {
    await (service as any).gerarListaCnab({}, { id: 1140 }, undefined, true, [], false);
    const [cnab104] = (stringifyCnab104File as jest.Mock).mock.calls[0];
    return cnab104.lotes.map((l: any) => ({ forma: l.headerLote.formaLancamento, docs: l.registros.map((r: any) => r.numeroDocumento) }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__localTzOffset = 0; // o CustomLogger usa esse offset para formatar o timestamp
    (stringifyCnab104File as jest.Mock).mockReturnValue(['cnab']);
    headerLoteService = { findAll: jest.fn() };
    detalheAService = { getDetalheAHeaderLote: jest.fn() };
    service = new RemessaService(
      { getHistoricosOrdemDetalheA: jest.fn().mockResolvedValue({ userBankCode: 104, username: 'x' }) } as any,
      {} as any,
      headerLoteService as any,
      detalheAService as any,
      { findDetalheBDetalheAId: jest.fn().mockResolvedValue({}) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(CnabHeaderLote104PgtoDTO, 'convert').mockImplementation((h: any) => ({ formaLancamento: h.formaLancamento }) as any);
    // o numero do documento identifica o pagamento; o banco de destino e de proposito 104 em todos (como a Caixa) para provar que nao filtra por banco
    jest.spyOn(DetalhesToCnab, 'convert').mockImplementation(async (a: any) => ({ numeroDocumento: a.id, detalheA: { codigoBancoDestino: { value: '104' }, nsr: { value: a.nsr } }, detalheB: { nsr: { value: a.nsr + 1 } } }) as any);
  });

  it('cada pagamento sai uma unica vez, no lote em que foi gerado (poupanca 05, TED 41 e conta corrente 01 juntos)', async () => {
    headerLoteService.findAll.mockResolvedValue([lote(1460, '05'), lote(1461, '41'), lote(1462, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) =>
      ({ 1460: [detalheA(1), detalheA(2)], 1461: [detalheA(3), detalheA(4), detalheA(5)], 1462: [detalheA(6), detalheA(7)] } as any)[loteId]);

    const lotes = await gerar();

    expect(lotes).toEqual([
      { forma: '05', docs: [1, 2] },
      { forma: '41', docs: [3, 4, 5] },
      { forma: '01', docs: [6, 7] },
    ]);
    expect(lotes.flatMap((l: any) => l.docs)).toHaveLength(7);
  });

  it('NSR sai sequencial dentro de cada lote mesmo que o gravado tenha lacuna ou repita', async () => {
    headerLoteService.findAll.mockResolvedValue([lote(1, '41'), lote(2, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) =>
      (loteId === 1 ? [{ id: 1, nsr: 1 }, { id: 2, nsr: 3 }, { id: 3, nsr: 233 }] : [{ id: 4, nsr: 1 }, { id: 5, nsr: 231 }]));

    await gerar();
    const [cnab104] = (stringifyCnab104File as jest.Mock).mock.calls[0];
    const nsrs = cnab104.lotes.map((l: any) => l.registros.flatMap((r: any) => [r.detalheA.nsr.value, r.detalheB.nsr.value]));

    expect(nsrs).toEqual([[1, 2, 3, 4, 5, 6], [1, 2, 3, 4]]);
  });

  it('lote sem pagamentos sai vazio (nao herda pagamentos de outros lotes)', async () => {
    headerLoteService.findAll.mockResolvedValue([lote(1, '05'), lote(2, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) => (loteId === 2 ? [detalheA(9)] : []));

    const lotes = await gerar();

    expect(lotes).toEqual([
      { forma: '05', docs: [] },
      { forma: '01', docs: [9] },
    ]);
  });
});
