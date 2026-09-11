import { buildRetornoCnab } from './build-retorno-cnab';
import { parseCnab240Pagamento } from 'src/cnab/utils/cnab/cnab-104-utils';
import { CustomLogger } from 'src/utils/custom-logger';

beforeAll(() => {
  (global as any).__localTzOffset = 0;
  for (const m of ['debug', 'log', 'warn', 'error'] as const) {
    jest.spyOn(CustomLogger.prototype, m).mockImplementation(() => undefined);
  }
});

describe('buildRetornoCnab', () => {
  it('gera um CNAB que parseCnab240Pagamento consegue ler, com os campos controlados', () => {
    const content = buildRetornoCnab([
      {
        ocorrenciaHeaderLote: '00',
        registros: [
          { cpf: '55032451720', valor: 4497.6, ocorrenciaDetalheA: '00', dataVencimento: '08062026' },
          { cpf: '12345678901', valor: 123.45, ocorrenciaDetalheA: '02' },
        ],
      },
    ]);

    // todas as linhas com 240 colunas
    for (const l of content.split('\r\n').filter(Boolean)) {
      expect(l.length).toBe(240);
    }

    const parsed: any = parseCnab240Pagamento(content);
    expect(parsed.lotes).toHaveLength(1);
    const lote = parsed.lotes[0];
    expect(lote.headerLote.ocorrencias.value.trim()).toBe('00');
    expect(lote.registros).toHaveLength(2);

    expect(lote.registros[0].detalheB.numeroInscricao.convertedValue.toString()).toBe('55032451720');
    expect(Number(lote.registros[0].detalheA.valorLancamento.convertedValue)).toBeCloseTo(4497.6, 2);
    expect(lote.registros[0].detalheA.ocorrencias.value.trim()).toBe('00');

    expect(lote.registros[1].detalheB.numeroInscricao.convertedValue.toString()).toBe('12345678901');
    expect(Number(lote.registros[1].detalheA.valorLancamento.convertedValue)).toBeCloseTo(123.45, 2);
    expect(lote.registros[1].detalheA.ocorrencias.value.trim()).toBe('02');
  });

  it('suporta multiplos lotes', () => {
    const content = buildRetornoCnab([
      { registros: [{ cpf: '11111111111', valor: 10, ocorrenciaDetalheA: '00' }] },
      { registros: [{ cpf: '22222222222', valor: 20, ocorrenciaDetalheA: 'BD' }] },
    ]);
    const parsed: any = parseCnab240Pagamento(content);
    expect(parsed.lotes).toHaveLength(2);
    expect(parsed.lotes[1].registros[0].detalheA.ocorrencias.value.trim()).toBe('BD');
  });
});
