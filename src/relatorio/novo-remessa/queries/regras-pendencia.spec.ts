import {
  pendenciaAgrupamentoNuncaEnviadoGuardador,
  pendenciaRejeitadaGuardador,
} from './regras-pendencia';

// ordem_pagamento_guardador não tem índice em "ordemPagamentoAgrupadoId": sem o CASE, o planner aplicava a função
// fn_ordem_guardador_ja_paga_ou_em_andamento em todas as linhas antes de comparar o agrupamento (17 s no consolidado de
// guardadores; 0,4 s com o CASE, mesmo resultado).
describe('regras-pendencia - guardador compara o agrupamento antes de chamar a função', () => {
  it('pendenciaRejeitadaGuardador (x_reg)', () => {
    const sql = pendenciaRejeitadaGuardador({ oph: 'oph', da: 'da', opa: 'opa', pu: 'pu' });

    expect(sql).toContain('CASE WHEN x_reg."ordemPagamentoAgrupadoId" = opa.id THEN (');
    expect(sql).toContain('fn_ordem_guardador_ja_paga_ou_em_andamento(x_reg.id)');
    expect(sql).toContain('ELSE FALSE END');
    expect(sql).not.toContain('WHERE x_reg."ordemPagamentoAgrupadoId" = opa.id');
  });

  it('pendenciaAgrupamentoNuncaEnviadoGuardador (x_nunca)', () => {
    const sql = pendenciaAgrupamentoNuncaEnviadoGuardador('opa', 'pu');

    expect(sql).toContain('CASE WHEN x_nunca."ordemPagamentoAgrupadoId" = opa.id THEN (');
    expect(sql).toContain('fn_ordem_guardador_ja_paga_ou_em_andamento(x_nunca.id)');
    expect(sql).toContain('ELSE FALSE END');
    expect(sql).not.toContain('WHERE x_nunca."ordemPagamentoAgrupadoId" = opa.id');
  });
});
