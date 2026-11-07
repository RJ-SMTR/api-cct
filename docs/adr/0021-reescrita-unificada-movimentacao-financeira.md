# ADR 0021: Reescrita unificada do Relatório de Movimentação Financeira

Data: 2026-11-06
Status: aceito, não implementado

## Contexto

O Relatório de Movimentação Financeira existe hoje em duas implementações quase-duplicadas
(Permissionário em `relatorio-novo-remessa-financial-movement.service.ts` +
`novo-remessa-query-builder.ts`; Guardador em
`relatorio-guardador-financial-movement.repository.ts` +
`guardador-novo-remessa-query-builder.ts`), cada uma com seu próprio SQL cru, CTEs e
paginação por keyset-cursor. 20 ADRs (0001–0020) registram bugs reais de cálculo/filtro já
corrigidos nessas implementações, vários no mesmo dia (2026-11-06): união de "A Pagar",
`MODAIS_FILTER` vs. filtro de consórcio, fallback de Eleição por `cpfCnpj`, filtro de
Erro/Rejeitado/Estorno igual ao Consolidado, entre outros (ver `CONTEXT.md`, seção "Relatório
de Movimentação Financeira" e correlatas).

Pedido: reescrever a camada de queries/services desse relatório (visual do `app-cct` não
muda) em um módulo novo, unificando a lógica dos dois perfis (Permissionário e Guardador) em
vez de mantê-la duplicada. Investigação paralela (ver sessão de 2026-11-06) confirmou que o
vocabulário de filtros do relatório já corresponde bem às categorias reais de geração de
remessa (`StatusRemessaEnum`, `OcorrenciaEnum`, pagadores `ContaBilhetagem`/`ContaRotativo`/
`CETT`, modal vs. consórcio vs. guardador) — a reescrita não precisa inventar filtros novos,
só reorganizar como a query é construída.

## Decisão

Três decisões tomadas por Rayanne em 2026-11-06:

1. **Re-derivar da regra de negócio, não portar o SQL atual linha a linha.** A nova
   implementação é escrita a partir do que está documentado em `CONTEXT.md`/ADRs 0001–0020
   (a especificação de comportamento), não copiando a estrutura SQL existente. Risco aceito
   explicitamente: por não copiar a query antiga, uma regra sutil pode ser interpretada de
   forma diferente da decisão original, ou uma correção já aplicada pode não ser reproduzida
   se não estiver clara na documentação — por isso o próximo ponto (paralelo + paridade) é
   obrigatório como rede de segurança.
2. **Rollout em paralelo com testes de paridade antes de qualquer corte.** O código novo vive
   em diretório próprio dentro de `src/relatorio/`, com specs de integração (padrão
   `RUN_RETORNO_DB_TESTS=1`) comparando resultado linha a linha contra a implementação atual
   em cenários reais, por regra documentada. O controller só passa a chamar a versão nova
   depois que a paridade for demonstrada (ou uma divergência for discutida e aceita
   explicitamente como mudança de comportamento, nunca descoberta later).
3. **Primeiro corte cobre tudo de uma vez**: base (Pago/A Pagar/Aguardando Pagamento),
   Pendência Paga, Pendência de Pagamento (Erro/Estorno/Rejeitado), Pendentes, Eleição e
   STUC-Gratuidade, para os dois perfis (Permissionário e Guardador), já na primeira entrega —
   não há corte incremental por categoria.
4. **Bug conhecido do cursor de paginação do Permissionário (tie-breakers insuficientes, ADR
   0002) é corrigido na reescrita, não reproduzido.** A nova implementação nasce com os
   tie-breakers completos (mesmo padrão que o Guardador já tem hoje). É uma divergência
   intencional em relação ao comportamento antigo, documentada como tal nos testes de
   paridade (não é uma regressão a investigar se o teste de paridade desse caso específico
   divergir).
5. **Export (CSV/XLSX/PDF) entra no escopo desta reescrita.** `writeFinancialMovementExport`
   e as colunas `BASE_COLUMNS`/`STUC_COLUMNS` são adaptadas junto, já que dependem direto do
   formato de linha retornado pela nova query.
6. **Mudanças de DTO (campos internos) e o ajuste correspondente em `app-cct`
   (`reportSlice.js`) acontecem na mesma task/entrega**, não em PRs desacoplados — evita um
   período em que os dois repositórios ficam fora de sincronia quanto ao formato de dados.

## Consequências

- Maior risco de regressão de cálculo financeiro do que um port 1:1 teria, por desenho
  (decisão 1); mitigado só pela decisão 2 (paridade obrigatória antes do cutover). Os testes
  de paridade precisam cobrir explicitamente cada regra do `CONTEXT.md`/ADR 0001–0020, não só
  os casos felizes — a lista desses ADRs é o checklist de aceite da reescrita.
- Por ser "tudo de uma vez" (decisão 3), o PRD e o plano de tasks subsequentes (`to-prd`,
  `task-planner`) não terão cortes menores entregáveis isoladamente; a feature só fica pronta
  para troca quando todas as sub-queries dos dois perfis tiverem paridade comprovada. Isso
  aumenta o tempo até o primeiro cutover possível, mas evita um período intermediário em que
  parte do relatório usa a lógica antiga e parte a nova.
- Guardador e Permissionário passam a compartilhar a mesma camada de resolução de status/CTE,
  parametrizada por perfil — elimina a duplicação atual, mas exige que as diferenças reais
  entre os dois perfis (Guardador não tem Eleição nem STUC-Gratuidade; cursor de paginação do
  Guardador tem uma coluna extra, `codigoErro`; tie-breakers de paginação do Permissionário
  ainda têm um bug conhecido e não corrigido — ver `CONTEXT.md`, "Cursor de paginação") sejam
  parametrizadas explicitamente, não perdidas na unificação.
- Contrato de API (rotas) permanece o mesmo; DTOs internos podem mudar, com atualização
  correspondente no `app-cct` (`reportSlice.js`) onde necessário — decidido em sessão anterior
  (2026-11-06, antes deste ADR).
- Este ADR não implementa nada; a implementação segue o workflow do projeto
  (`grill-with-docs` → `to-prd` → `task-planner` → `task-runner`), com `docs/PRD.md` e o plano
  de tasks escritos a partir daqui.
