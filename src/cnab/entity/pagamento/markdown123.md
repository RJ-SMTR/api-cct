
## Passos da tarefa

- [x] Alinhar como salvaremos as ocorrências.
- [ ] Atualizar lógica de Ocorrências
- [ ] Atualizar lógica para TransacaoAgrupados
- [ ] Testar retorno com status OK em todas as ocorrências
- [ ] Testar retorno com status OK no headerLote e todas as ocorrências com falha em 1 dos arquivos

### Como vamos salvar as ocorrências

Salvaremos as ocorrências em:

- headerLote
- detalheA

Por que tem ocorrências no header/trailer lote e não apenas no detalheA? Para que serve?

O do header são do pagador.
O detalhe é do favorecido.
O trailer são dos cálculos automáticos. Como temos pouco tempo não vamos mexer com isso nessa sprint.

### Atualizar lógica de Ocorrências

- Ocorrências relaciona com HeaderArquivo e DetalheA
- Tirar relação de Transação
- Atualizar Migrations