# ADR 0010: Remover `SELECT DISTINCT` de `buildPendenciaPagaTemplate`/`buildPendenciaPagamentoTemplate` (TD-14)

Data: 2026-10-21
Status: aceito

## Contexto

O ADR 0007 corrigiu `buildGroupedQuery` (usada por `buildBaseQuery`/`buildStucGratuidadeQuery`
em `src/relatorio/novo-remessa/queries/novo-remessa-query-builder.ts`), removendo um
`SELECT DISTINCT` que colapsava ordens de pagamento distintas do mesmo agrupamento quando
coincidiam em valor, subcontando o total de Consolidado/Movimentação Financeira. Esse mesmo
ADR já registrou (e o `docs/TECH-DEBT.md` abriu como TD-14) que `buildPendenciaPagaTemplate`
(status "Pendencia Paga") e `buildPendenciaPagamentoTemplate` (status "Estorno"/"Rejeitado"
via agrupamento pai) tinham o mesmo padrão — `SELECT DISTINCT` sem `op.id` na lista de
colunas — mas isso era uma suspeita, não confirmada.

Durante uma verificação pedida pelo usuário (comparar o relatório de Movimentação Financeira
do Permissionário com o banco, para os status Pago/A Pagar/Pendência de Pagamento), confirmei
a suspeita com dado real no banco local (sincronizado separadamente de produção, mas mesmo
schema/dados reais): filtrando Pendência de Pagamento → Estorno para 02/04/2026, a tela
mostrava R$ 2.637,43 contra R$ 2.951,15 (soma direta no banco, mesma lógica de
`buildPendenciaPagamentoTemplate` sem o `DISTINCT`) — uma subcontagem de R$ 313,72.

Isolando a causa: `opa.id=253902` (CPF 29709920782) tem 3 ordens de pagamento distintas
(`op.id` 34723, 35787, 36572), cada uma de R$ 12,38, idênticas em todas as outras colunas
exibidas (nome, email, banco, cpfCnpj, consórcio, dataPagamento, status). O
`SELECT DISTINCT` colapsava as 3 em 1 única linha de R$ 12,38 em vez de R$ 37,14 — o mesmo
mecanismo do ADR 0007, só que no agrupamento pai/filha de Pendência de Pagamento em vez do
agrupamento normal.

## Decisão

Remover o `DISTINCT` de `buildPendenciaPagaTemplate` e `buildPendenciaPagamentoTemplate`,
mesma correção do ADR 0007 e mesmo raciocínio: nenhuma das duas depende de `DISTINCT` para
evitar duplicação real por fan-out de JOIN (os mesmos JOINs 1:1 do ADR 0007 se aplicam aqui);
ele só colapsava coincidências de valor dentro do mesmo agrupamento. Nenhuma outra mudança de
lógica, filtro ou assinatura.

## Consequências

- Pendência Paga e Pendência de Pagamento (Estorno/Rejeitado via agrupamento pai) na
  Movimentação Financeira do Permissionário passam a contar o valor correto quando duas
  ordens de pagamento do mesmo agrupamento coincidem em valor.
- TD-14 fechado (`docs/TECH-DEBT.md`), com o caso real acima como critério de pagamento.
- A branch nova de "Estorno/Rejeitado sem agrupamento pai" (ADR 0008, PR separado) não é
  afetada por esta mudança — ela nunca usou `DISTINCT`.
- Nenhuma mudança de assinatura, parâmetro ou filtro — só a remoção do `DISTINCT` nas duas
  funções.
