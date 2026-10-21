import * as xlsx from 'xlsx';
import { OrdemPagamentoService } from './ordem-pagamento.service';

describe('OrdemPagamentoService - importação da planilha de guardadores', () => {
  beforeAll(() => {
    // O CustomLogger soma global.__localTzOffset ao timestamp; fora do bootstrap fica indefinido.
    (global as any).__localTzOffset = (global as any).__localTzOffset ?? 0;
  });

  const planilha = (abas: Record<string, any[][]>) => {
    const wb = xlsx.utils.book_new();
    for (const [nome, linhas] of Object.entries(abas)) {
      xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(linhas), nome);
    }
    return { buffer: xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }), originalname: 'Pagamento 20_10.xlsx' } as any;
  };

  const build = (cpfsCadastrados: string[]) => {
    const saveMany = jest.fn().mockResolvedValue(undefined);
    const usersService = {
      findOne: jest.fn(async ({ cpfCnpj }: { cpfCnpj: string }) =>
        cpfsCadastrados.includes(cpfCnpj) ? { id: Number(cpfCnpj.slice(-4)) || 1, cpfCnpj } : null),
    };
    const service = new OrdemPagamentoService({} as any, { saveMany } as any, {} as any, usersService as any);
    return { service, saveMany };
  };

  const inseridos = (saveMany: jest.Mock) => saveMany.mock.calls[0][0] as any[];

  it('planilha SEM cabeçalho: importa também a primeira linha', async () => {
    const { service, saveMany } = build(['00051049716', '00153188774', '00186497776']);

    const r = await service.importGuardadorSpreadsheet(
      planilha({ Guardadores: [['00051049716', 'R$ 2,80'], ['00153188774', 'R$ 175,00'], ['00186497776', 'R$ 532,00']] }),
    );

    expect(r).toMatchObject({ totalRows: 3, imported: 3, skipped: 0 });
    expect(inseridos(saveMany).map((o) => [o.idOrdemPagamento, o.valorRepasseGuardador])).toEqual([
      ['00051049716', 2.8],
      ['00153188774', 175],
      ['00186497776', 532],
    ]);
  });

  it('planilha COM cabeçalho: o cabeçalho não vira ordem e as linhas de dados são todas importadas', async () => {
    const { service, saveMany } = build(['00153188774', '00186497776']);

    const r = await service.importGuardadorSpreadsheet(
      planilha({ Guardadores: [['CPF', 'Valor'], ['00153188774', 'R$ 175,00'], ['00186497776', 'R$ 532,00']] }),
    );

    expect(r).toMatchObject({ totalRows: 2, imported: 2, skipped: 0 });
    expect(inseridos(saveMany).map((o) => o.idOrdemPagamento)).toEqual(['00153188774', '00186497776']);
  });

  it('várias abas: aba sem cabeçalho e aba "Entidades" com cabeçalho (CNPJ/Valor)', async () => {
    const { service, saveMany } = build(['00051049716', '05019730000158']);

    const r = await service.importGuardadorSpreadsheet(
      planilha({
        Guardadores: [['00051049716', 'R$ 2,80']],
        Entidades: [['Entidade', 'CNPJ', 'Valor'], ['ANGLAE', '05.019.730/0001-58', 'R$ 5.146,79']],
      }),
    );

    expect(r).toMatchObject({ totalRows: 2, imported: 2, skipped: 0 });
    expect(inseridos(saveMany).map((o) => [o.idOrdemPagamento, o.valorRepasseGuardador])).toEqual([
      ['00051049716', 2.8],
      ['05019730000158', 5146.79],
    ]);
  });

  it('informa a linha da planilha nos erros, com e sem cabeçalho', async () => {
    const { service } = build(['00153188774']);

    const semCabecalho = await service.importGuardadorSpreadsheet(
      planilha({ A: [['00051049716', 'R$ 2,80'], ['00153188774', 'R$ 175,00']] }),
    );
    expect(semCabecalho.errors).toEqual([expect.objectContaining({ row: 1, documento: '00051049716' })]);

    const comCabecalho = await service.importGuardadorSpreadsheet(
      planilha({ A: [['CPF', 'Valor'], ['00051049716', 'R$ 2,80']] }),
    );
    expect(comCabecalho.errors).toEqual([expect.objectContaining({ row: 2, documento: '00051049716' })]);
  });

  it('ignora linhas em branco no fim da planilha', async () => {
    const { service, saveMany } = build(['00051049716']);

    const r = await service.importGuardadorSpreadsheet(
      planilha({ A: [['00051049716', 'R$ 2,80'], [null, null], [null, null]] }),
    );

    expect(r).toMatchObject({ totalRows: 1, imported: 1 });
    expect(inseridos(saveMany)).toHaveLength(1);
  });

  it('colunas vazias à direita (sem cabeçalho) não derrubam a importação: o valor é o da última coluna preenchida', async () => {
    const { service, saveMany } = build(['70883238772', '71951350715']);
    // A planilha real ("Pagamento retroativo 13_10.xlsx") tem 5 colunas no intervalo, só A e B preenchidas.
    const ws = xlsx.utils.aoa_to_sheet([['70883238772', 'R$ 169.40'], ['71951350715', 'R$ 303.80']]);
    ws['!ref'] = 'A1:E2';
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Página1');

    const r = await service.importGuardadorSpreadsheet({
      buffer: xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      originalname: 'Pagamento retroativo 13_10.xlsx',
    } as any);

    expect(r).toMatchObject({ totalRows: 2, imported: 2, skipped: 0 });
    expect(inseridos(saveMany).map((o) => [o.idOrdemPagamento, o.valorRepasseGuardador])).toEqual([
      ['70883238772', 169.4],
      ['71951350715', 303.8],
    ]);
  });

  it('colunas vazias à direita (com cabeçalho sem "Valor"): usa a última coluna preenchida', async () => {
    const { service, saveMany } = build(['00153188774']);
    const ws = xlsx.utils.aoa_to_sheet([['Documento', 'Pagamento'], ['00153188774', 'R$ 175,00']]);
    ws['!ref'] = 'A1:D2';
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'A');

    const r = await service.importGuardadorSpreadsheet({ buffer: xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }), originalname: 'x.xlsx' } as any);

    expect(r).toMatchObject({ totalRows: 1, imported: 1 });
    expect(inseridos(saveMany)[0].valorRepasseGuardador).toBe(175);
  });
});
