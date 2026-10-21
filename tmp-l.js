"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const pagamento_pendente_repository_1 = require("./src/cnab/novo-remessa/repository/pagamento-pendente.repository");
(async () => {
    if (process.env.DATABASE_HOST !== 'localhost')
        throw new Error('nao local');
    const ds = new typeorm_1.DataSource({ type: 'postgres', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
    await ds.initialize();
    const repo = new pagamento_pendente_repository_1.PagamentoPendenteRepository(ds);
    const hoje = new Date('2026-10-20T00:00:00Z');
    console.time('listar');
    console.log('listar', (await repo.listarPreparados('guardadores', hoje)).length);
    console.timeEnd('listar');
    console.time('limpar');
    console.log('limpar', JSON.stringify(await repo.limparPreparo('guardadores', hoje)));
    console.timeEnd('limpar');
    await ds.destroy();
})().catch((e) => { console.error(e.message); process.exit(1); });
//# sourceMappingURL=tmp-l.js.map