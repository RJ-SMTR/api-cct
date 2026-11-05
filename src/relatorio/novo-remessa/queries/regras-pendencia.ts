import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';

/**
 * Regras de "Pendência de Pagamento" iguais às da procedure P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES
 * (migrations ProtegePendentesContraDuplicidade1791500000000 e PendentesConsorcioSomaUnica1791700000000).
 *
 * Os relatórios Consolidado e Movimentação Financeira só devem listar como pendência o que a procedure efetivamente
 * pagaria de novo; do contrário o valor do relatório diverge do remessa gerado.
 */

/** "Hoje" no horário de Brasília: ordens do dia corrente nunca são pendência. */
export const SQL_HOJE_BRASILIA = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

/**
 * Condição sobre as ordens de guardador de um agrupamento, que só avalia `condicao` nas ordens daquele agrupamento.
 *
 * ordem_pagamento_guardador não tem índice em "ordemPagamentoAgrupadoId", então o planner faz seq scan e aplica o
 * filtro em todas as linhas ANTES de comparar o agrupamento. Com `fn_ordem_guardador_ja_paga_ou_em_andamento` (uma
 * consulta por chamada) dentro da condição, eram ~16 mil chamadas por consulta: o ramo de pendentes do consolidado de
 * guardadores levava 17 s, e o ramo base 4,6 s. O CASE obriga a comparar o agrupamento primeiro e deixa a função só para
 * as poucas ordens do agrupamento (0,4 s nos dois, mesmo resultado linha a linha). Semântica igual a
 * `ordem."ordemPagamentoAgrupadoId" = agrupamento.id AND (condicao)`.
 */
const ORDEM_DO_AGRUPAMENTO_E = (ordem: string, agrupamento: string, condicao: string) =>
  `CASE WHEN ${ordem}."ordemPagamentoAgrupadoId" = ${agrupamento}.id THEN (${condicao}) ELSE FALSE END`;

/** Motivos de retorno que NÃO são rejeição (aceito/agendado/pago). */
export const MOTIVOS_NAO_REJEICAO = ['AM', '00', 'BD'];

export interface AliasesPendenciaRejeitada {
  /** historico do agrupamento (ordem_pagamento_agrupado_historico) */
  oph: string;
  /** detalhe_a */
  da: string;
  /** agrupamento do historico (ordem_pagamento_agrupado) */
  opa: string;
  /** usuários que podem ser o favorecido (via ordem do agrupamento ou do pai) */
  users: string[];
}

/**
 * Pagamento rejeitado pelo banco que a procedure trataria como pendência (PASSO 1):
 *  - statusRemessa 4 com motivo de erro (fora AM/00/BD);
 *  - valor lançado diferente de zero (abatimento zera o valor e o banco rejeita com AR: não há o que pagar);
 *  - usuário não bloqueado;
 *  - agrupamento sem outro histórico pago/em andamento (1,2,3,5) nem pai criado/em andamento/pago (0,1,2,3,5);
 *  - sem ordem de hoje e sem ordem equivalente já paga ou em pagamento;
 *  - conta só a última tentativa rejeitada de cada agrupamento (reenvio rejeitado de novo não soma em dobro).
 */
export function pendenciaRejeitadaPermissionario({ oph, da, opa, users }: AliasesPendenciaRejeitada): string {
  const motivosNaoRejeicao = MOTIVOS_NAO_REJEICAO.map((m) => `'${m}'`).join(', ');
  const bloqueado = users.map((u) => `${u}."bloqueado" IS NOT TRUE`).join(' AND ');
  return `(${oph}."statusRemessa" = 4
      AND ${oph}."motivoStatusRemessa" IS NOT NULL
      AND ${oph}."motivoStatusRemessa" NOT IN (${motivosNaoRejeicao})
      AND ${da}."valorLancamento" <> '0.00'
      AND ${bloqueado}
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_agrupado_historico hp_reg
         WHERE (hp_reg."ordemPagamentoAgrupadoId" = ${opa}.id AND hp_reg."statusRemessa" IN (1, 2, 3, 5))
            OR (hp_reg."ordemPagamentoAgrupadoId" = ${opa}."ordemPagamentoAgrupadoId" AND hp_reg."statusRemessa" IN (0, 1, 2, 3, 5)))
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento x_reg
         WHERE x_reg."ordemPagamentoAgrupadoId" = ${opa}.id
           AND (date_trunc('day', x_reg."dataCaptura") >= ${SQL_HOJE_BRASILIA}
                OR public.fn_ordem_pagamento_ja_paga_ou_em_andamento(x_reg.id)))
      AND ${da}.id = (
        SELECT MAX(d_reg.id)
          FROM detalhe_a d_reg
          JOIN ordem_pagamento_agrupado_historico h_reg ON h_reg.id = d_reg."ordemPagamentoAgrupadoHistoricoId"
         WHERE h_reg."ordemPagamentoAgrupadoId" = ${oph}."ordemPagamentoAgrupadoId"
           AND h_reg."statusRemessa" = 4
           AND h_reg."motivoStatusRemessa" IS NOT NULL
           AND h_reg."motivoStatusRemessa" NOT IN (${motivosNaoRejeicao})
           AND d_reg."valorLancamento" <> '0.00'))`;
}

/**
 * Ordem nunca agrupada que a procedure trataria como pendência (PASSO 0): capturada há mais de 10 dias e antes de hoje,
 * valor diferente de zero, favorecido ativo com dados bancários completos e sem equivalente já paga ou em pagamento.
 */
export function pendenciaOrdemSoltaPermissionario(op: string, pu: string): string {
  return `AND ${op}.valor <> 0
      AND date_trunc('day', ${op}."dataCaptura") <= (CURRENT_DATE - INTERVAL '10 days')
      AND date_trunc('day', ${op}."dataCaptura") < ${SQL_HOJE_BRASILIA}
      AND ${pu}."bankAccount" IS NOT NULL
      AND ${pu}."bankAgency" IS NOT NULL
      AND ${pu}."bankCode" IS NOT NULL
      AND ${pu}."bankAccountDigit" IS NOT NULL
      AND NOT public.fn_ordem_pagamento_ja_paga_ou_em_andamento(${op}.id)`;
}

/**
 * Guardadores: mesmas regras da procedure P_AGRUPAR_ORDENS_GUARDADOR_PENDENTE (migrations
 * ProtegePendentesContraDuplicidade1791500000000, PendentesGuardadorOrdensNaoEnviadas1791600000000 e
 * PendentesGuardadorSomaUnica1791800000000).
 */
export interface AliasesPendenciaRejeitadaGuardador {
  oph: string;
  da: string;
  opa: string;
  /** usuário favorecido (guardador) */
  pu: string;
}

/** PASSO 1 (guardador): rejeição real do banco que a procedure pagaria de novo. */
export function pendenciaRejeitadaGuardador({ oph, da, opa, pu }: AliasesPendenciaRejeitadaGuardador): string {
  const motivosNaoRejeicao = MOTIVOS_NAO_REJEICAO.map((m) => `'${m}'`).join(', ');
  return `(${oph}."statusRemessa" = 4
      AND ${oph}."motivoStatusRemessa" IS NOT NULL
      AND ${oph}."motivoStatusRemessa" NOT IN (${motivosNaoRejeicao})
      AND ${da}."valorLancamento" <> '0.00'
      AND ${pu}."bloqueado" IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_agrupado_historico hp_reg
         WHERE (hp_reg."ordemPagamentoAgrupadoId" = ${opa}.id AND hp_reg."statusRemessa" IN (1, 2, 3, 5))
            OR (hp_reg."ordemPagamentoAgrupadoId" = ${opa}."ordemPagamentoAgrupadoId" AND hp_reg."statusRemessa" IN (0, 1, 2, 3, 5)))
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_guardador x_reg
         WHERE ${ORDEM_DO_AGRUPAMENTO_E('x_reg', opa, `date_trunc('day', x_reg."dataOrdem") >= ${SQL_HOJE_BRASILIA}
                OR public.fn_ordem_guardador_ja_paga_ou_em_andamento(x_reg.id)`)})
      AND ${da}.id = (
        SELECT MAX(d_reg.id)
          FROM detalhe_a d_reg
          JOIN ordem_pagamento_agrupado_historico h_reg ON h_reg.id = d_reg."ordemPagamentoAgrupadoHistoricoId"
         WHERE h_reg."ordemPagamentoAgrupadoId" = ${oph}."ordemPagamentoAgrupadoId"
           AND h_reg."statusRemessa" = 4
           AND h_reg."motivoStatusRemessa" IS NOT NULL
           AND h_reg."motivoStatusRemessa" NOT IN (${motivosNaoRejeicao})
           AND d_reg."valorLancamento" <> '0.00'))`;
}

const DADOS_BANCARIOS_COMPLETOS = (pu: string) => `${pu}."bankAccount" IS NOT NULL
      AND ${pu}."bankAgency" IS NOT NULL
      AND ${pu}."bankCode" IS NOT NULL
      AND ${pu}."bankAccountDigit" IS NOT NULL`;

/**
 * PASSO 0 (guardador): ordem nunca agrupada, de antes de hoje, valor diferente de zero, favorecido ativo com dados
 * bancários completos e sem equivalente já paga ou em pagamento. A janela de datas (dataOrdem) é a do período pedido.
 */
export function pendenciaOrdemSoltaGuardador(opg: string, pu: string): string {
  return `${opg}."ordemPagamentoAgrupadoId" IS NULL
      AND ${opg}."valorRepasseGuardador" <> 0
      AND date_trunc('day', ${opg}."dataOrdem") < ${SQL_HOJE_BRASILIA}
      AND ${pu}."bloqueado" IS NOT TRUE
      AND ${DADOS_BANCARIOS_COMPLETOS(pu)}
      AND NOT public.fn_ordem_guardador_ja_paga_ou_em_andamento(${opg}.id)`;
}

/**
 * PASSO 1, 3º ramo (guardador): agrupamento criado e nunca enviado (só histórico "Criado", sem detalhe_a), de antes de
 * ontem, sem pai nem filhos, de favorecido ativo com dados bancários completos e sem ordem de hoje/equivalente paga.
 */
export function pendenciaAgrupamentoNuncaEnviadoGuardador(opa: string, pu: string): string {
  return `${opa}."pagadorId" IN (SELECT pg_reg.id FROM pagador pg_reg WHERE pg_reg.conta = '${PagadorContaEnum.ContaRotativo}')
      AND ${opa}."ordemPagamentoAgrupadoId" IS NULL
      AND ${opa}."dataPagamento"::date < ${SQL_HOJE_BRASILIA} - 1
      AND ${pu}."bloqueado" IS NOT TRUE
      AND ${DADOS_BANCARIOS_COMPLETOS(pu)}
      AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado ch_reg WHERE ch_reg."ordemPagamentoAgrupadoId" = ${opa}.id)
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_agrupado_historico h_nunca
         WHERE h_nunca."ordemPagamentoAgrupadoId" = ${opa}.id AND h_nunca."statusRemessa" <> 0)
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_agrupado_historico h_nunca2
         JOIN detalhe_a da_nunca ON da_nunca."ordemPagamentoAgrupadoHistoricoId" = h_nunca2.id
         WHERE h_nunca2."ordemPagamentoAgrupadoId" = ${opa}.id)
      AND NOT EXISTS (
        SELECT 1 FROM ordem_pagamento_guardador x_nunca
         WHERE ${ORDEM_DO_AGRUPAMENTO_E('x_nunca', opa, `date_trunc('day', x_nunca."dataOrdem") >= ${SQL_HOJE_BRASILIA}
                OR public.fn_ordem_guardador_ja_paga_ou_em_andamento(x_nunca.id)`)})`;
}
