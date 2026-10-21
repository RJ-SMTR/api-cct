# ADR 0009: Consolidado - "Rejeitado" por statusRemessa (não lista de motivos) e "Aguardando Pagamento" só statusRemessa=2

Data: 2026-10-21
Status: aceito

## Contexto

Ao verificar se os filtros de status do Consolidado (perfil Permissionário,
fluxo normal - sem STUC) batem com o `STATUS_CASE` usado pela Movimentação
Financeira, uma consulta direta à produção (15-23/10/2026,
`ordem_pagamento_agrupado_historico`) achou dois problemas em
`RelatorioNovoRemessaConsolidadoRepository.findConsolidado`:

1. **"Aguardando Pagamento"** (`filter.emProcessamento`) filtrava
   `oph."statusRemessa" IN (1,2)`. No `STATUS_CASE`, `statusRemessa IN
   (0,1)` é **"A Pagar"**, não "Aguardando Pagamento" (só `statusRemessa=2`
   é). Em produção, 1.326 linhas com `statusRemessa=1` (reais "A Pagar")
   apareciam ao filtrar por "Aguardando Pagamento".

2. **"Rejeitado"** (`filter.rejeitado`) filtrava
   `oph."motivoStatusRemessa" IN ('AL','HO','ANHO')` - uma lista fixa de
   motivos, sem exigir `statusRemessa=4`. Isso causava dois problemas ao
   mesmo tempo, confirmados em produção (toda a tabela, sem filtro de
   data):
   - **Falsos negativos**: motivos reais de rejeição fora da lista (ex.:
     `'AM'` com 113 linhas, `'AR'` com 57, `'AJ'` com 1 - todos com
     `statusRemessa=4`) não eram capturados, embora o `STATUS_CASE` (via
     seu `ELSE`) os classifique como Rejeitado.
   - **Falsos positivos**: linhas de **outro** status que coincidem em
     motivo eram incluídas por engano - 1.278 linhas com
     `statusRemessa=3` e motivo `'AL'` (reais **Pago**, já que
     `statusRemessa=3` tem prioridade absoluta no `STATUS_CASE`) e 2
     linhas com `statusRemessa=5` e motivo `'AL'` (reais **Pendência
     Paga**).

A PR #1212 (`fix(relatorio): align STUC "Pendência de Pagamento"
status/motivo filter...`) já tinha corrigido um bug adjacente (AND vs OR
na combinação dos dois filtros), mas só para o "Todos" (`filter.erro`) do
STUC - o filtro "Rejeitado" isolado, no fluxo normal e no STUC, continuou
com a lista fixa de motivos.

## Decisão

1. `emProcessamento` passa a empurrar só `2` para `status` (não mais `1`).
2. Trocado o `subErroStatus.push('AL', 'HO', 'ANHO')` por uma condição
   dedicada `condicaoRejeitado`:
   `(oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR
   oph."motivoStatusRemessa" <> '02'))` - mesma semântica do `ELSE` do
   `STATUS_CASE` (qualquer motivo que não seja Estorno, dentro do bucket
   de erro). Usada tanto no `condicoesStatus` do fluxo normal quanto no
   `condicoesStuc` do STUC (`buildStucGratuidadeLiteral`), mantendo os
   dois fluxos alinhados.

### Alternativa descartada

Ampliar a lista fixa de motivos (acrescentar `'AM'`, `'AJ'`, `'AR'`, ...).
Descartada porque a lista nunca seria exaustiva - motivos de rejeição são
definidos pelo banco/retorno do CNAB, não pelo código; a próxima sigla nova
reproduziria o mesmo bug. A condição por `statusRemessa=4` (excluindo só o
motivo de Estorno) espelha exatamente o `ELSE` do `STATUS_CASE`, que já é
a fonte da verdade usada pela Movimentação Financeira.

## Consequências

- "Aguardando Pagamento" deixa de devolver linhas "A Pagar" (statusRemessa
  1). "A Pagar" continua só acessível via "Todos" nesta tela ou via o
  filtro "A pagar" de fato (consulta separada, ordens sem agrupamento) -
  nenhuma mudança nesse outro filtro.
- "Rejeitado" passa a bater com o `STATUS_CASE`: nem perde motivos novos
  fora de uma lista fixa, nem inclui por engano linhas Pago/Pendência Paga
  que coincidem em motivo.
- "Pendência de Pagamento: Todos" já estava correto antes (o
  `statusRemessa IN (4)` isolado já cobria todo mundo); a nova condição é
  redundante com ele nesse caso específico, mas inofensiva (`OR`).
- Nenhuma mudança em "Pago", "Estorno", "A pagar" ou "Pendencia Paga".
