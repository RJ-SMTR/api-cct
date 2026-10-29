import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ControleRemessaErroService, dataIso, ocorrenciaDaRemessa, statusDaRemessa } from './controle-remessa-erro.service';

const auto = { id: 10, nome: 'a.rem', dataGeracao: '2026-10-23', dataPagamento: '2026-10-23', favorecido: 'CONTA ROTATIVO', total: 188, pagos: 187, naoEfetivados: 1, valorPagar: '45167.46', valorPago: '45000.00', motivos: '02' };
const manual = { id: 3, dataGeracao: '2026-10-25', dataPagamento: null, nomeRemessa: 'b.rem', favorecido: 'Intersul', valorPagar: '100.50', valorPagoJuizo: null, valorTotalPago: '100.50', status: 'Pago', ocorrencia: 'Pago na mão' };

function build(respostas: any[][]) {
  const query = jest.fn(async () => respostas.shift() ?? []);
  return { service: new ControleRemessaErroService({ query } as any), query };
}

describe('ControleRemessaErroService', () => {
  it('statusDaRemessa e ocorrenciaDaRemessa', () => {
    expect(statusDaRemessa(10, 0, 10)).toBe('Não Pago');
    expect(statusDaRemessa(10, 9, 1)).toBe('Pago parcial');
    expect(statusDaRemessa(10, 0, 3)).toBe('Aguardando Pagamento');
    expect(ocorrenciaDaRemessa(10, 1, '02')).toContain('Motivo(s) do banco: 02');
    expect(ocorrenciaDaRemessa(10, 10, null)).toContain('Sem motivo informado');
  });

  it('dataIso só aceita AAAA-MM-DD válida', () => {
    expect(dataIso('2026-10-23')).toBe('2026-10-23');
    expect(dataIso('23/10/2026')).toBeUndefined();
    expect(dataIso(undefined)).toBeUndefined();
  });

  it('lista automáticos e manuais juntos, do mais recente ao mais antigo, com totais', async () => {
    const { service } = build([[auto], [manual]]);
    const r = await service.listar({ dataInicio: '2026-10-01', dataFim: '2026-10-31' });
    expect(r.itens.map((i) => i.id)).toEqual(['man-3', 'auto-10']);
    expect(r.itens[1]).toMatchObject({ origem: 'automatico', status: 'Pago parcial', valorTotalPago: 45000 });
    expect(r.totais).toMatchObject({ quantidade: 2, automaticos: 1, manuais: 1, valorPagar: 45267.96 });
  });

  it('filtra por origem, status e busca', async () => {
    const { service, query } = build([[manual]]);
    const r = await service.listar({ origem: 'manual', status: 'Pago', busca: 'INTERSUL' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(r.itens).toHaveLength(1);
    const outra = build([[auto], [manual]]);
    expect((await outra.service.listar({ status: 'Não Pago' })).itens).toHaveLength(0);
  });

  it('criar exige a data de geração e valida os valores', async () => {
    const { service } = build([]);
    await expect(service.criar({ nomeRemessa: 'x' }, 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.criar({ dataGeracao: '2026-10-23', valorPagar: 'abc' }, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('criar grava com o usuário e devolve o id', async () => {
    const { service, query } = build([[{ id: 7 }]]);
    await expect(service.criar({ dataGeracao: '2026-10-23', valorPagar: '10,5' as any, favorecido: ' Intersul ' }, 45)).rejects.toBeInstanceOf(BadRequestException);
    const ok = build([[{ id: 7 }]]);
    await expect(ok.service.criar({ dataGeracao: '2026-10-23', valorPagar: 10.555, favorecido: ' Intersul ' }, 45)).resolves.toEqual({ id: 'man-7' });
    const params = (ok.query.mock.calls[0] as any)[1];
    expect(params[3]).toBe('Intersul');
    expect(params[4]).toBe(10.56);
    expect(params[9]).toBe(45);
    expect(query).not.toHaveBeenCalled();
  });

  it('atualizar e excluir devolvem 404 quando o lançamento não existe', async () => {
    const { service } = build([[[], 0], [[], 0]]);
    await expect(service.atualizar(9, { dataGeracao: '2026-10-23' }, 1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.excluir(9)).rejects.toBeInstanceOf(NotFoundException);
  });
});
