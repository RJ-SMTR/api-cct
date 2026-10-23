import { RemessaService } from './remessa.service';
import { DetalhesToCnab } from '../convertTo/detalhes-to-cnab.convert';
import { CnabHeaderLote104PgtoDTO } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { stringifyCnab104File } from 'src/cnab/utils/cnab/cnab-104-utils';

jest.mock('src/cnab/utils/cnab/cnab-104-utils', () => ({ stringifyCnab104File: jest.fn() }));

/**
 * Regressoes da geracao do arquivo de remessa:
 * - 21/10/2026: o arquivo de guardadores saiu com pagamentos repetidos porque cada lote nao-TED recebia TODOS os pagamentos de banco 104.
 * - 23/10/2026: o banco rejeitou (AH) o NSR com lacuna/repetido dentro do lote, e 2 pagamentos da Caixa sairam no lote de TED.
 */
describe('RemessaService.gerarListaCnab - distribuicao dos pagamentos nos lotes', () => {
  let service: RemessaService;
  let headerLoteService: { findAll: jest.Mock };
  let detalheAService: { getDetalheAHeaderLote: jest.Mock };
  // banco/tipo de conta de cada pagamento (por id do detalhe), como gravado no historico
  let contas: Record<number, { userBankCode: number; userBankAccountType?: string }>;

  const lote = (id: number, formaLancamento: string) => ({ id, formaLancamento });
  const detalheA = (id: number, nsr = 1) => ({ id, nsr });

  const gerar = async () => {
    await (service as any).gerarListaCnab({}, { id: 1140 }, undefined, true, [], false);
    const [cnab104] = (stringifyCnab104File as jest.Mock).mock.calls[0];
    return cnab104.lotes.map((l: any) => ({
      forma: l.headerLote.formaLancamento,
      docs: l.registros.map((r: any) => r.numeroDocumento),
      nsrs: l.registros.flatMap((r: any) => [r.detalheA.nsr.value, r.detalheB.nsr.value]),
      valoresReais: l.registros.map((r: any) => r.detalheA.valorRealEfetivado.value),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__localTzOffset = 0; // o CustomLogger usa esse offset para formatar o timestamp
    (stringifyCnab104File as jest.Mock).mockReturnValue(['cnab']);
    contas = {};
    headerLoteService = { findAll: jest.fn() };
    detalheAService = { getDetalheAHeaderLote: jest.fn() };
    service = new RemessaService(
      { getHistoricosOrdemDetalheA: jest.fn(async (id: number) => ({ username: 'x', ...(contas[id] ?? { userBankCode: 341 }) })) } as any,
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
    // o numero do documento identifica o pagamento; o nsr gravado e propagado para provar que a geracao o renumera
    jest.spyOn(DetalhesToCnab, 'convert').mockImplementation(async (a: any) => ({
      numeroDocumento: a.id,
      detalheA: { nsr: { value: a.nsr }, valorRealEfetivado: { value: 999 } },
      detalheB: { nsr: { value: a.nsr + 1 } },
    }) as any);
  });

  it('cada pagamento sai uma unica vez, no lote da forma do seu banco (poupanca 05, TED 41 e conta corrente 01 juntos)', async () => {
    contas = { 1: { userBankCode: 104, userBankAccountType: 'poupanca' }, 2: { userBankCode: 104, userBankAccountType: 'poupanca' }, 6: { userBankCode: 104 }, 7: { userBankCode: 104 } };
    headerLoteService.findAll.mockResolvedValue([lote(1460, '05'), lote(1461, '41'), lote(1462, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) =>
      ({ 1460: [detalheA(1), detalheA(2)], 1461: [detalheA(3), detalheA(4), detalheA(5)], 1462: [detalheA(6), detalheA(7)] } as any)[loteId]);

    const lotes = await gerar();

    expect(lotes.map((l: any) => ({ forma: l.forma, docs: l.docs }))).toEqual([
      { forma: '05', docs: [1, 2] },
      { forma: '41', docs: [3, 4, 5] },
      { forma: '01', docs: [6, 7] },
    ]);
    expect(lotes.flatMap((l: any) => l.docs)).toHaveLength(7);
  });

  it('pagamento da Caixa preparado no lote de TED sai no lote de conta corrente, com NSR sequencial nos dois lotes', async () => {
    contas = { 3: { userBankCode: 104 }, 5: { userBankCode: 104 }, 6: { userBankCode: 104 } };
    headerLoteService.findAll.mockResolvedValue([lote(1, '41'), lote(2, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) =>
      (loteId === 1 ? [detalheA(1, 1), detalheA(2, 3), detalheA(3, 231), detalheA(4, 233), detalheA(5, 3413)] : [detalheA(6, 1)]));

    const lotes = await gerar();

    expect(lotes).toEqual([
      { forma: '41', docs: [1, 2, 4], nsrs: [1, 2, 3, 4, 5, 6], valoresReais: [0, 0, 0] },
      { forma: '01', docs: [3, 5, 6], nsrs: [1, 2, 3, 4, 5, 6], valoresReais: [0, 0, 0] },
    ]);
  });

  it('sem lote da forma do pagamento, mantem o lote em que foi preparado', async () => {
    contas = { 1: { userBankCode: 104 } };
    headerLoteService.findAll.mockResolvedValue([lote(1, '41')]);
    detalheAService.getDetalheAHeaderLote.mockResolvedValue([detalheA(1)]);

    expect((await gerar()).map((l: any) => l.docs)).toEqual([[1]]);
  });

  it('lote sem pagamentos sai vazio (nao herda pagamentos de outros lotes)', async () => {
    contas = { 9: { userBankCode: 104 } };
    headerLoteService.findAll.mockResolvedValue([lote(1, '05'), lote(2, '01')]);
    detalheAService.getDetalheAHeaderLote.mockImplementation(async (loteId: number) => (loteId === 2 ? [detalheA(9)] : []));

    expect((await gerar()).map((l: any) => ({ forma: l.forma, docs: l.docs }))).toEqual([
      { forma: '05', docs: [] },
      { forma: '01', docs: [9] },
    ]);
  });
});
