# ADR 0016: Estender a restrição "uma ordem por agrupamento" (ADR 0011) ao Consolidado Permissionário

Data: 2026-11-03
Status: aceito

## Contexto

Validando o Relatório Consolidado (perfil Permissionário) com "Todos" os status selecionados em
três janelas de data diferentes, os totais bateram exatamente com uma reconstrução independente
no banco para janelas de 15 e 64 dias — sem duplicação de valor. Para uma janela de 90 dias, a
mesma busca falhou no Postgres local (Docker, `shared_buffers=128MB`, `work_mem=4MB`) com
`could not resize shared memory segment ... No space left on device`, devolvendo HTTP 400
(`GET /api/v1/cnab/relatorio-novo-remessa/consolidado?dataInicio=2026-06-01&dataFim=2026-08-31`).

A causa raiz é o mesmo mecanismo do ADR 0011, nunca corrigido neste arquivo porque o sintoma
(valor errado) nunca apareceu aqui. `RelatorioNovoRemessaConsolidadoRepository.getQueryConsorcios`/
`getQueryVanzeiros` (`fromQueryPrincipal`) têm sua própria implementação paralela de query —
não usam o query-builder compartilhado de `novo-remessa-query-builder.ts`, que já ganhou a
restrição do ADR 0011. O `JOIN` com `ordem_pagamento` não se limita a uma ordem representante por
agrupamento: cada linha de `detalhe_a` é multiplicada pelo número de ordens internas do mesmo
agrupamento. Confirmado com dado real: um agrupamento (`opa.id`) tinha **55** `ordem_pagamento`
internas para 1 único lançamento de R$ 4.660.553,36 — a mesma linha vira 55 antes de qualquer
`GROUP BY`.

O `SELECT DISTINCT (nome, nome2, valor, idLinha)` já existente neste repository colapsa essas 55
linhas de volta a 1 "por acidente", quando `nome`/`nome2`/`valor` ficam idênticos entre elas (o
próprio ADR 0011 já registrou essa observação: "o Consolidado não sofria essa sobrecontagem... seu
`SELECT DISTINCT` já colapsa, por acidente, as linhas fanned-out"). O resultado final sempre esteve
certo — o problema é que o Postgres precisa materializar, ordenar e deduplicar todas as linhas
multiplicadas *antes* de colapsar, e isso consome memória proporcional ao fan-out, não ao número
real de lançamentos. Com uma janela de 90 dias e "Todos" os status (mais sub-queries unidas, mais
agrupamentos no período), esse consumo passou do limite disponível.

Testei o mesmo cenário (90 dias, "Todos" os status) no perfil **Guardador**
(`relatorio-guardador-consolidado.repository.ts`, usa `guardador-novo-remessa-query-builder.ts` —
um builder diferente) e não reproduziu: HTTP 200 em ~15s. O problema é isolado ao Permissionário.

## Decisão

Restringir `getQueryConsorcios`/`getQueryVanzeiros` (e as consultas de Pendência Paga do mesmo
arquivo, que compartilham `fromQueryPrincipalComPai`) a **uma única `ordem_pagamento`
representante por agrupamento**, mesmo padrão do ADR 0011:
`AND op.id = (SELECT MIN(o.id) FROM ordem_pagamento o WHERE o."ordemPagamentoAgrupadoId" = opafi.id)`
(e o equivalente para `opp`/`opai`). Isso elimina o fan-out antes do `SELECT DISTINCT` processar,
em vez de depender dele para colapsar de volta.

Validei manualmente que a restrição não muda o resultado: para uma query de 64 dias (onde a versão
atual roda sem falhar), o total com e sem a restrição é idêntico.

A tarefa de implementação deve **medir, não assumir**: a sub-query correlacionada com `MIN(o.id)`
é o padrão já usado e documentado no ADR 0011, mas esse ADR não precisou lidar com esgotamento de
memória — só com valor errado. Antes de fechar a tarefa, confirmar contra o caso real que falhava
(90 dias, "Todos" os status, Permissionário) que a mudança resolve o esgotamento, e comparar com a
alternativa `DISTINCT ON (opafi.id)` caso a sub-query correlacionada não seja suficiente.

Escopo restrito ao Permissionário — Guardador já confirmado sem o problema.

### Alternativas descartadas

- **Só aumentar os limites do Postgres** (`shared_buffers`/`work_mem`): não é uma correção, é
  adiar o problema para uma janela de data maior ou um volume de dados maior; a config local já é
  modesta, mas o fan-out é estrutural e pode se repetir em produção com mais dados.
- **Limitar o intervalo de datas na UI para "Todos" os status**: empurra o problema para uma
  restrição de uso em vez de corrigir a causa; descartado a favor da correção estrutural.
- **Reescrever `fromQueryPrincipal` para reusar o query-builder compartilhado**: eliminaria a
  duplicação de lógica entre Consolidado e Movimentação Financeira/Guardador, mas é uma mudança
  bem maior em código de pagamento: fora de escopo desta correção pontual.

## Consequências

- Consolidado Permissionário passa a processar um volume de linhas proporcional ao número real de
  lançamentos no período, não ao número de ordens internas de cada agrupamento — deve resolver o
  esgotamento de memória em janelas largas e reduzir o tempo de resposta mesmo em janelas que já
  funcionavam.
- Nenhuma mudança de valor esperada (já validado para o caso de 64 dias); a tarefa de implementação
  deve validar o mesmo para 90 dias assim que a query passar a rodar.
- Mesma técnica (sub-query correlacionada) do ADR 0011, reaproveitando um padrão já revisado em vez
  de introduzir um novo.
- Fica de fora desta ADR: a decisão de eventualmente unificar `fromQueryPrincipal` com o
  query-builder compartilhado — registrada como alternativa descartada, não como trabalho futuro
  decidido.
