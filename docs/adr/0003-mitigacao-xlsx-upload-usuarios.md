# ADR 0003: Mitigar o risco do `xlsx` no upload de cadastro de usuários sem troca de biblioteca

Data: 2026-10-08
Status: aceito

## Contexto

A dependência `xlsx` (SheetJS, pacote npm, hoje `^0.18.5`) tem duas CVEs HIGH
sem fix publicado no registro do npm: Prototype Pollution e ReDoS (a SheetJS
move os patches para fora do npm, para `cdn.sheetjs.com`). Registrado em
TD-11 (`docs/TECH-DEBT.md`).

No código, `xlsx.read(file.buffer, ...)` (`src/users/users.service.ts`,
`getWorksheetFromFile`) e `xlsx.utils.sheet_to_json` (`getUserFilesFromWorksheet`)
parseiam a planilha enviada pelo endpoint `POST /users/upload` (cadastro em
massa de usuários) — um arquivo controlado por quem faz o upload, não um
arquivo interno. O endpoint:

- Exige JWT (`@UseGuards(AuthGuard('jwt'))`), mas **não tem `@Roles`**: hoje
  qualquer usuário autenticado pode chamar, não só administradores.
- Valida o tipo do arquivo só pelo `mimetype` que o próprio client envia
  (`FileTypeValidationPipe`), que é trivialmente falsificável — não há
  sniffing real de conteúdo.
- Não tem limite de tamanho configurado no `FileInterceptor('file')`.

`xlsx.read` é **síncrono** e roda na thread única do Node: um payload que
explore o ReDoS trava o processo inteiro (não só a requisição), afetando
todos os usuários da API enquanto durar.

## Decisão

Mitigar em volta do `xlsx`, sem trocar de biblioteca nem trocar a origem do
pacote (origem CDN da própria SheetJS foi considerada e descartada por ora:
instalar de fora do registro npm padrão tem custo de confiança de supply
chain que não foi avaliado). Três mitigações, todas no caminho de
`POST /users/upload`:

1. **Limite de tamanho: 10 MB**, configurado no `FileInterceptor('file')`
   (`limits.fileSize`). Hoje não há limite nenhum.
2. **Sniff real de conteúdo** antes de chamar `xlsx.read`: verificar a
   assinatura do arquivo (magic bytes do ZIP, que é o formato real por
   trás do `.xlsx`, ou heurística simples para CSV), em vez de confiar só
   no `mimetype` enviado pelo client.
3. **Isolamento em `worker_thread` com timeout de 10 segundos** para o
   parse (`xlsx.read` + `sheet_to_json`): como o parse é síncrono e
   bloqueia a thread principal, um timeout no código que chama (ex.
   `Promise.race` sem worker) não interrompe um ReDoS em andamento — só
   para de esperar, o bloqueio continua. A worker thread é encerrada
   (`worker.terminate()`) se não responder dentro do prazo, protegendo o
   processo principal.

**Fora de escopo desta decisão:** se `POST /users/upload` deveria exigir
`@Roles(RoleEnum.admin)` (ou equivalente) fica como pergunta em aberto,
investigada separadamente — não foi resolvido se o acesso amplo de hoje é
intencional ou uma falha.

## Consequências

- Reduz o dano possível (tamanho do payload, chance de um arquivo
  disfarçado chegar ao parser, duração do bloqueio em caso de exploração),
  mas **não fecha as CVEs**: um payload pequeño e bem formado ainda pode
  acionar Prototype Pollution dentro da janela de 10s, ou um ReDoS que
  conclua antes do timeout. Isso é uma mitigação de defesa em profundidade,
  não uma correção da vulnerabilidade.
- Introduz complexidade de `worker_threads` num código antes síncrono e
  simples — maior superfície para bugs de concorrência/serialização de
  erro entre worker e thread principal.
- Se mais adiante a decisão mudar para trocar de biblioteca (`exceljs`) ou
  usar a build patcheada da SheetJS via CDN, estas três mitigações
  continuam válidas como defesa em profundidade e não precisam ser
  revertidas.
- TD-11 permanece `aberto` quanto ao `xlsx`: a entrada será atualizada para
  registrar que a mitigação (não a correção) foi implementada.

## Alternativas consideradas

- **Build patcheada da SheetJS via CDN** (`cdn.sheetjs.com`): mesma API, sem
  reescrever código, mas instala de fora do registro npm padrão — avaliação
  de confiança de supply chain não feita, descartada por ora.
- **Troca de biblioteca** (ex. `exceljs`): resolveria a CVE de fato, mas
  exige reescrever `getWorksheetFromFile`/`getUserFilesFromWorksheet`/
  `validateFileHeaders` e os testes — maior escopo, descartado para esta
  rodada em favor da mitigação mais rápida.
