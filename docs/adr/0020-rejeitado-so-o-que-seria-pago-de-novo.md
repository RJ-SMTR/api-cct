# ADR 0020: "Erro"/"Rejeitado"/"Estorno" mostra só o que ainda seria pago de novo

Data: 2026-11-06
Status: aceito, implementado

## Contexto

Com o mesmo filtro (Erro/Rejeitado/Estorno, jan–jul/2026), a Movimentação Financeira mostra
todas as linhas rejeitadas do período (bate com o banco, lendo direto de
`ordem_pagamento_agrupado_historico`/`STATUS_CASE`). O Consolidado mostra só as linhas cuja
rejeição ainda não foi substituída por uma tentativa de pagamento mais recente — uma ordem que
falhou e depois foi reagrupada/paga com sucesso não aparece como "Rejeitado" no Consolidado,
mesmo tendo tido uma linha de erro no histórico.

Exemplo confirmado contra produção: jan/fev/mar/jul/2026 o Consolidado mostra R$ 0,00 em
Erro/Rejeitado/Estorno enquanto a Movimentação Financeira mostra valores reais (ex.: jan R$
1.877,18) — porque todas as rejeições desses meses já foram repagas com sucesso depois.

## Decisão

Mantém a regra do Consolidado: "Erro"/"Rejeitado"/"Estorno" mostra só as linhas que ainda
seriam pagas de novo (rejeição sem tentativa de pagamento posterior bem-sucedida). A
Movimentação Financeira precisa parar de mostrar toda rejeição histórica e passar a aplicar a
mesma regra do Consolidado.

Confirmado por Rayanne em 2026-11-06.

## Consequências

- `buildBaseQuery`/`STATUS_CASE` (Movimentação Financeira) passam a excluir, do bucket
  "Rejeitado"/"Estorno", as linhas cuja ordem já tem uma tentativa de pagamento posterior
  bem-sucedida — mesma lógica que o Consolidado já usa (ver
  `RelatorioNovoRemessaConsolidadoRepository`, filtro de rejeitado/erro).
- Uma rejeição "resolvida" (reagrupada e paga com sucesso depois) deixa de contar como erro do
  período nas duas telas, igual ao Consolidado hoje. Isso reduz os valores de Erro/Rejeitado da
  Movimentação Financeira nos períodos em que havia rejeições já corrigidas.
- Sem mudança na classificação `STATUS_CASE` em si (continua `statusRemessa=4`/motivo diferente
  de Estorno = Rejeitado); a mudança é um filtro adicional sobre quais linhas aparecem quando o
  usuário pede "Erro"/"Rejeitado"/"Estorno" especificamente, não na classificação do status de
  cada linha individual.
