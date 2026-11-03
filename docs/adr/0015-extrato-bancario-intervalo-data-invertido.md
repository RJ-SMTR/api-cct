# ADR 0015: Extrato Bancário deve rejeitar/zerar intervalo de data invertido, não ignorá-lo

Data: 2026-11-03
Status: proposto

## Contexto

Em `RelatorioExtratoBancarioRepository.getQuery` (`src/relatorio/extrato-bancario/relatorio-extrato-bancario.repository.ts`),
o filtro de `dataInicio`/`dataFim` só é aplicado quando a condição
`dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio)` é verdadeira — mesmo padrão
usado nos outros relatórios de `relatorio/` (`analitico`, `sintetico`, família `novo-remessa`).

Quando `dataFim < dataInicio` (input inválido, por erro do usuário ou bug no front), a condição
inteira é falsa e o `and de."dataLancamento" between ...` nunca entra na query — não é que a busca
retorna vazio, é que ela roda **sem filtro de data nenhum**, trazendo todo o histórico de
lançamentos bancários do extrato. Achado durante a entrevista de RN desta tela (2026-11-03);
confirmado com o usuário como bug a corrigir, não comportamento aceito.

## Decisão

Um intervalo invertido deve produzir um erro de validação (ou, no mínimo, um resultado vazio) —
nunca ignorar o filtro de data silenciosamente. A correção fica para uma tarefa separada
([RJ-SMTR/api-cct#1276](https://github.com/RJ-SMTR/api-cct/issues/1276)); este ADR registra só a
decisão de qual é o comportamento correto.

Escopo desta decisão: só `RelatorioExtratoBancarioRepository`, a única das três telas de
relatório legado (`analitico`, `sintetico`, `extrato-bancario`) que tem endpoint ativo hoje
(`GET /cnab/relatorio/extrato`). Os outros dois arquivos têm o mesmo padrão de condição, mas não
foram corrigidos aqui — ver `CONTEXT.md` ("Áreas frágeis") sobre o estado deles.

## Consequências

- Um input de data inválido para de parecer uma consulta normal (que por acaso trouxe muita
  linha) e passa a ser visivelmente rejeitado.
- Não resolve o mesmo padrão em `relatorio-analitico.repository.ts`/`relatorio-sintetico.repository.ts`
  — ambos sem endpoint ativo hoje, então o risco prático é menor; decisão separada se/quando essas
  telas forem reativadas.
