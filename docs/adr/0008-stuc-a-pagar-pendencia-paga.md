# ADR 0008: STUC - Gratuidade honra "A pagar" e "Pendência Paga" no Consolidado

Data: 2026-10-21
Status: aceito

## Contexto

Na tela do Consolidado (perfil Permissionário, `app-cct`), o combo de Status
(`STATUS_OPTIONS`: Todos/A pagar/Aguardando Pagamento/Pago/Pendência de
Pagamento/Pendencia Paga) continua totalmente disponível quando o combo
Específico tem `STUC - Gratuidade` marcado — só `OPs atrasadas` (dentro do
sub-combo de motivo) é removido nesse caso (ADR 0004).

No backend, `RelatorioNovoRemessaConsolidadoRepository.findConsolidado`
monta a consulta de STUC (`buildStucGratuidadeLiteral`) adicionando como
filtro de status só o que vem de `status`/`subErroStatus`
(`pago`→3, `emProcessamento`→1,2, `erro`→4, `rejeitado`/`estorno`→motivo).
As flags `aPagar` e `pendenciaPaga` são computadas mas só usadas pelas
consultas do fluxo normal (`queryApagarConsorcios/Vanzeiros`,
`queryPendenciaPagaConsorcios/Vanzeiros`), que são descartadas inteiramente
quando `filter.stucGratuidade` é verdadeiro.

Resultado: selecionar **"A pagar"** ou **"Pendencia Paga"** junto com
`STUC - Gratuidade` não lança nenhum erro e parece um filtro válido na
tela, mas o backend ignora a flag silenciosamente - a consulta devolve o
mesmo total de "Todos" (confirmado em produção, 2026-10-20: ambos os
filtros isolados devolvem as mesmas 5.850 linhas / R$ 483.565,00 de
"Todos", em vez de um subconjunto). Quem está vendo a tela com "A pagar"
selecionado via valor igual ao de "Pago" - o que pareceu, a quem reportou,
como "os dois status ao mesmo tempo".

Isso diverge da Movimentação Financeira
(`relatorio-novo-remessa-financial-movement.service.ts`), que já trata os
dois corretamente para STUC: `aPagar` entra no `$4`/`STATUS_CASE` da
própria `buildStucGratuidadeQuery`, e `pendenciaPaga` tem sua própria
consulta dedicada (`buildStucGratuidadePendenciaPagaSingleDateQuery`, já
existente no query-builder compartilhado, só não usada pelo Consolidado).

## Decisão

1. **"A pagar"**: para STUC, não existe o estado "sem agrupamento" que o
   fluxo normal usa para "A pagar" (a gratuidade já nasce agrupada, ADR
   0004) - o equivalente é o bucket cru `A Pagar` do `STATUS_CASE`
   (`statusRemessa IN (0,1)`), igual à Movimentação Financeira. Adicionado
   um array `statusStuc` (cópia de `status` só quando `filter.aPagar`,
   acrescida de `0,1`) usado apenas dentro de `buildStucGratuidadeLiteral`
   - sem alterar `status`/`condicoesStatus` do fluxo normal, que não usa
   esse bucket hoje.
2. **"Pendencia Paga"**: adicionada uma segunda consulta STUC (consórcio e
   vanzeiro, mesma lógica de restrição MODAIS/CONSORCIOS do bloco
   existente), reaproveitando `buildStucGratuidadePendenciaPagaSingleDateQuery`
   já existente no query-builder compartilhado - mesmo padrão de
   substituição literal de `$1..$5` já usado por `buildStucGratuidadeLiteral`,
   acionada só quando `filter.pendenciaPaga` é verdadeiro (paridade com o
   fluxo normal, que também só roda sua consulta de pendência paga nesse
   caso).

### Alternativa descartada

Esconder "A pagar"/"Pendencia Paga" da tela quando STUC está selecionado,
igual ao que já é feito para "OPs atrasadas" (ADR 0004). Descartada porque,
diferente de "OPs atrasadas" (que não tem conceito equivalente para
gratuidade), os dois estados existem de fato para a gratuidade - a
Movimentação Financeira já prova isso ao tratá-los corretamente. Esconder
a opção escondia dados reais em vez de corrigir o filtro.

## Consequências

- Consolidado com STUC - Gratuidade e "A pagar"/"Pendencia Paga"
  selecionados passa a retornar um subconjunto real dos dados, em vez do
  mesmo total de "Todos".
- Nenhuma mudança no fluxo normal (não-STUC) nem no combo Específico
  (Eleição/Desativados/Pendentes).
- Consolidado e Movimentação Financeira ficam alinhados para os dois
  filtros, igual já estavam para Pago/Aguardando Pagamento/Estorno/
  Rejeitado.
