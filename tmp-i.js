"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const pagamentos_indevidos_guardadores_service_1 = require("./src/pagamento_indevido/service/pagamentos-indevidos-guardadores.service");
(async () => {
    if (process.env.DATABASE_HOST !== 'localhost')
        throw new Error('nao local');
    const ds = new typeorm_1.DataSource({ type: 'postgres', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
    await ds.initialize();
    const s = new pagamentos_indevidos_guardadores_service_1.PagamentosIndevidosGuardadoresService(ds);
    for (const f of [{}, { situacao: 'devendo' }]) {
        const r = await s.listar(Object.assign(Object.assign({}, f), { pageSize: 3 }));
        console.log(JSON.stringify(f), r.total, JSON.stringify(r.totais));
    }
    console.log((await s.exportar({})).itens.length);
    await ds.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
//# sourceMappingURL=tmp-i.js.map