"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const pagamento_pendente_repository_1 = require("./src/cnab/novo-remessa/repository/pagamento-pendente.repository");
async function snap(ds) {
    const [a] = await ds.query(`select (select count(*) from ordem_pagamento_agrupado) opa, (select count(*) from ordem_pagamento_agrupado_historico) oph,
    (select count(*) from ordem_pagamento where "ordemPagamentoAgrupadoId" is null) op_null, (select count(*) from ordem_pagamento_guardador where "ordemPagamentoAgrupadoId" is null) og_null,
    (select count(*) from ordem_pagamento_agrupado where "ordemPagamentoAgrupadoId" is not null) filhas`);
    return JSON.stringify(a);
}
(async () => {
    if (process.env.DATABASE_HOST !== 'localhost')
        throw new Error('nao local');
    const ds = new typeorm_1.DataSource({ type: 'postgres', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
    await ds.initialize();
    const repo = new pagamento_pendente_repository_1.PagamentoPendenteRepository(ds);
    const hoje = new Date('2026-10-20T00:00:00Z');
    for (const [tipo, call] of [
        ['guardadores', `CALL P_AGRUPAR_ORDENS_GUARDADOR_PENDENTE('2025-01-01 00:00:00','2026-10-19 23:59:59','2026-10-20',3)`],
        ['permissionarios', `CALL P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES('2025-01-01 00:00:00','2026-10-19 23:59:59','2026-10-20',1,NULL)`],
    ]) {
        console.log('==', tipo);
        const antes = await snap(ds);
        console.log('antes ', antes);
        await ds.query(call);
        console.log('apos  ', await snap(ds));
        console.log('preparados c/ detalhe_a:', (await repo.listarPreparados(tipo, hoje)).length);
        console.log('sync tipo conta:', await repo.sincronizarTipoContaHistorico(tipo, hoje));
        console.log('limpar:', JSON.stringify(await repo.limparPreparo(tipo, hoje)));
        const depois = await snap(ds);
        console.log('depois', depois, depois === antes ? '=> IGUAL ao antes' : '=> DIFERENTE!');
    }
    await ds.destroy();
})().catch((e) => { console.error(e.message); process.exit(1); });
//# sourceMappingURL=tmp-p.js.map