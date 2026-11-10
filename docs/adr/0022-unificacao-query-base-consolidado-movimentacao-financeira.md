# ADR 0022: Unificação da query base entre Consolidado e Movimentação Financeira (fatia 1)

Data: 2026-11-09
Status: aceito, não implementado

## Contexto

O Relatório Consolidado (`relatorio-novo-remessa-consolidado.repository.ts`, perfil
Permissionário) e o Relatório de Movimentação Financeira (em reescrita pelo ADR 0021,
`movimentacao-financeira-v2/`) compartilham a mesma regra de negócio de base — status
(Pago/A Pagar/Aguardando Pagamento), dedupe de fan-out (ADR 0011), filtro de valor
pós-agrupamento (ADR 0002), cast de data (ADR 0005) — mas hoje têm implementações de query
totalmente separadas e duplicadas. A diferença real entre os dois relatórios não é a regra de
seleção de linhas, é a camada de exibição: Movimentação Financeira mostra uma linha por
lançamento; Consolidado agrega com `SUM(valor) GROUP BY favorecido` (ou por consórcio) no
período inteiro (confirmado no código, `relatorio-novo-remessa-consolidado.repository.ts`,
`getQueryVanzeiros`/`getQueryConsorcios`). O pivot por dia de janela de pagamento (ADR 0012)
é exclusivo do filtro Específico/STUC-Gratuidade, fora desta fatia.

O ADR 0021 excluiu Consolidado do escopo da reescrita ("Non-Goals"). Esta decisão (2026-11-09,
Rayanne, em sessão de chat) é tratá-lo como trabalho novo, em paralelo a T3–T11 do ADR 0021,
consumindo a mesma base (`BasePagamentoRepository`, T2) em vez de esperar o cutover completo
da Movimentação Financeira.

## Decisão

1. **Começa agora, em paralelo ao T3–T11 do ADR 0021**, não depois do cutover da Movimentação
   Financeira. `BasePagamentoRepository` pode mudar enquanto T3–T11 ainda rodam — risco aceito
   explicitamente (ver Consequências).
2. **Unificação por fatia, não tudo de uma vez.** Primeira fatia: só as categorias que
   `BasePagamentoRepository` já cobre (Pago/A Pagar/Aguardando Pagamento). Pendência Paga/
   Pagamento (depende de T5), Eleição (T7) e STUC-Gratuidade (T8, inclui o pivot de dia) entram
   no Consolidado conforme as tasks correspondentes do ADR 0021 forem ficando `done` — cada uma
   é sua própria fatia de unificação depois, não uma decisão nova.
3. **Perfil: só Permissionário nesta fatia.** Guardador (`relatorio-guardador-consolidado.repository.ts`)
   fica para uma fatia posterior — é estruturalmente mais simples (sem a lista de
   modais/consórcio institucional), mas não é feito junto agora para manter o corte pequeno.
4. **Rollout: paridade offline + rota `v2` paralela em produção, as duas coisas, não uma ou
   outra.** Mesmo padrão do ADR 0021 (decisão 2 e 7 daquele ADR): specs de integração
   comparando resultado linha a linha contra `getQueryVanzeiros`/`getQueryConsorcios` atuais, **e**
   uma rota HTTP `v2` real (`.../v2/report/consolidado...`, espelhando a rota atual) para
   comparação lado a lado com dados reais, acessível antes do cutover. A rota antiga continua
   intocada e servindo tráfego real até uma decisão de cutover específica (a definir quando essa
   fatia estiver pronta — segue o mesmo modelo do T12 do ADR 0021, inclusive a exigência de
   comunicar o time financeiro antes do deploy).
5. **Paridade é com o comportamento corrigido de hoje, não com bugs antigos já resolvidos.**
   A nova implementação reproduz o resultado atual do Consolidado já com as correções do ADR
   0016 (bug de memória em janelas largas) e ADR 0020 (Erro/Rejeitado só o que seria pago de
   novo) — essas correções não são refeitas do zero, são o alvo de paridade.
6. **Módulo novo, implementação antiga intocada.** Mesmo padrão do ADR 0021: código novo em
   diretório próprio (ex.: `src/relatorio/consolidado-v2/` ou dentro de
   `movimentacao-financeira-v2/`, a decidir no planejamento de tasks), consumindo
   `BasePagamentoRepository` + uma camada de agregação (`SUM(valor) GROUP BY favorecido`) por
   cima. `relatorio-novo-remessa-consolidado.repository.ts` não é alterado nem removido nesta
   fatia.

## Consequências

- **Risco aceito de instabilidade cruzada**: como `BasePagamentoRepository` ainda está sendo
  construída pelo T3–T11 do ADR 0021 (filtros de Favorecido/Consórcio/Modal em T3, paginação em
  T4, etc.) ao mesmo tempo em que o Consolidado passa a depender dela, uma mudança de T3–T11
  pode exigir retrabalho na camada de agregação do Consolidado. Mitigação: a fatia 1 usa só o
  que T2 já entregou e testou (`findGroupedRows`), que não é tocado por T3–T11 (eles adicionam
  filtros/paginação por cima, não mudam a query base). Se T3+ mudar a assinatura ou o
  comportamento de `findGroupedRows`, o Consolidado-v2 precisa reajustar — comunicado como risco
  conhecido, não descoberto depois.
- Guardador e as demais categorias (Pendência Paga/Pagamento, Eleição, STUC-Gratuidade) ficam
  pendentes, sem ADR de cutover ainda — cada fatia futura decide seu próprio momento.
- Duas rotas `v2` paralelas em produção simultaneamente (Movimentação Financeira do ADR 0021 e
  Consolidado deste ADR) — mesmo guard de autenticação/autorização das rotas atuais em ambas,
  mesma comunicação de "só para comparação até cutover".
- O corte pequeno (1 perfil, 1 fatia de categoria) significa que o Consolidado como um todo
  continua rodando na implementação antiga por mais tempo — aceito em troca de começar já em
  vez de esperar T11.

## Não decidido ainda (ver tasks)

- Nome final do diretório/módulo (`consolidado-v2` vs dentro de `movimentacao-financeira-v2`).
- Estrutura exata das rotas `v2` do Consolidado e se reaproveitam algum controller existente.
- Plano de tasks detalhado — segue para `to-prd`/`task-planner` depois deste ADR.
