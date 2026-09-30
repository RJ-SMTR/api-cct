# src/cnab

CNAB 240 layouts for the bank files (Caixa, bank code 104) and the payment pipeline in `novo-remessa/`. The layout is defined by the bank, not by us.

## Layout

- `templates/`, `interfaces/`, `enums/`, `dto/`, `const/`: field definitions, positions and allowed values for each record (file header, lot header, DetalheA, DetalheB, extrato).
- `utils/cnab/`: parsing and generation (`parseCnab240Pagamento`, `stringifyCnab104File`, field utilities).
- `novo-remessa/service/`: `remessa.service.ts` (prepare, generate text, send), `retorno.service.ts` (read and apply the return), order, grouping and lock services.
- `cnab.service.ts` also reads the extrato (`readRetornoExtrato`) and has its own older generate/send methods.

## Do not

- Do not change field positions, lengths, formats or constants in the templates or enums without the bank specification. A wrong field can make the bank reject the whole file or pay the wrong amount.
- Do not call `getNextNSA` or anything that writes the `any__cnab_*` settings (NSA, NSR) while exploring or testing: each call consumes a number that must never repeat. Use the `_test` NSA setting for tests.
- Do not generate, send or read CNAB files against a real SFTP or database without an explicit request.
- Do not reset or edit `any__cnab_current_nsa`, `any__cnab_current_nsr_sequence` or `any__cnab_last_nsr_sequence` by hand.

## Things that are easy to get wrong

- `HeaderArquivoStatus` goes criado, remessaGerado, remessaEnviado. An existing header in `remessaGerado` is reused instead of consuming a new NSA.
- Credit to an account of bank 104 uses `Cnab104FormaLancamento.CreditoContaCorrente`; other banks use TED (forma de lançamento `41`). NSR counters for TED and conta corrente are separate.
- The return is matched to a `DetalheA` by the CPF/CNPJ of the `DetalheB` and the amount. Changing how those are generated changes the matching.
- `SftpService.submitCnabRemessa` returns the path in a `finally`, so an upload failure after the path is set can still look like success.
- Business meaning of the terms (NSA, NSR, DetalheA, ocorrência) is in `CONTEXT.md`.

## Verification

The specs in `utils/cnab/` and `test/cnab-service/` currently fail (TD-1); `retorno.service.spec.ts` and `build-retorno-cnab.spec.ts` pass. Validate with `npx tsc --noEmit -p tsconfig.build.json`, `npm run validate` and careful reading against the field templates.
