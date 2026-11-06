# ADR 0019: Eleição/Movimentação Financeira - fallback por cpfCnpj quando idOperadora é null

Data: 2026-11-06
Status: aceito, implementação pendente

## Contexto

`buildEleicaoQuery` (`novo-remessa-query-builder.ts:464-472`) liga a ordem ao favorecido por
`pu."permitCode" = opu."idOperadora"`, não por CPF/CNPJ — decisão de 19/10/2026, documentada em
comentário no próprio arquivo: ligar por `cpfCnpj` causa fan-out quando um favorecido tem mais de
um cadastro ativo com o mesmo CPF (achado contra stag), dobrando o valor da ordem no total.

Isso descarta ordens antigas: em nov/2024, 806 das 807 ordens têm `opu."idOperadora"` = `NULL` —
o campo não existia preenchido na época —, então nenhum `JOIN` por `permitCode` as encontra e a
Movimentação Financeira mostra R$ 0,00 para Pago em out/nov/dez/2024, enquanto o Consolidado
(que liga por `cpfCnpj`) mostra os valores corretos (nov/2024: R$ 830.180,00, bate com produção).

Verificado contra o banco (2026-11-06, somente leitura): das 806 ordens de nov/2024 sem
`idOperadora`, as 806 têm `cpfCnpj` distinto e cada um bate com exatamente 1 usuário — nenhum
caso de CPF duplicado entre elas. O bug de fan-out por CPF duplicado é de cadastros atuais (stag,
2026), população diferente da de 2024.

## Decisão

Mantém o join por `permitCode` como principal (preserva a correção do fan-out). Acrescenta um
fallback por `cpfCnpj`, usado **só quando não existe nenhum usuário com aquele `permitCode`**
(equivalente a `opu."idOperadora"` não ter correspondência, incluindo o caso de ser `NULL`).

Confirmado por Rayanne em 2026-11-06, após verificação direta no banco de que o fallback não
reintroduz o fan-out.

## Consequências

- `buildEleicaoQuery` passa a ter um `LEFT JOIN` por `permitCode` e, quando ele não encontra
  correspondência, cai para `cpfCnpj` (via `COALESCE`/`UNION`/`LEFT JOIN LATERAL`, a decidir na
  implementação) em vez do `INNER JOIN` único atual.
- Ordens antigas sem `idOperadora` preenchido (pelo menos nov/2024-?) voltam a aparecer na
  Movimentação Financeira da Eleição.
- Sem risco de reintroduzir o fan-out de CPF duplicado: o fallback só é usado para o subconjunto
  de ordens sem `permitCode` correspondente, que (verificado) não tem CPF duplicado.
