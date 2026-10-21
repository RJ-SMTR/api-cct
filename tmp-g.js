"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const dashboard_pagamentos_repository_1 = require("./src/cnab/novo-remessa/repository/dashboard-pagamentos.repository");
(async () => {
    if (process.env.DATABASE_HOST !== 'localhost')
        throw new Error('nao local');
    const ds = new typeorm_1.DataSource({ type: 'postgres', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
    await ds.initialize();
    const r = new dashboard_pagamentos_repository_1.DashboardPagamentosRepository(ds);
    const base = { dataInicio: '2026-10-01', dataFim: '2026-10-20', conta: 'bilhetagem', page: 1, pageSize: 5 };
    for (const g of [undefined, 'GTU', 'GTU,VLT', 'GTU,VLT,Santa Cruz']) {
        const d = await r.detalhe(Object.assign(Object.assign({}, base), { grupo: g }));
        console.log(g !== null && g !== void 0 ? g : '(todos)', d.total, [...new Set(d.itens.map(i => i.grupo))].join('|'));
    }
    const e = await r.exportar(Object.assign(Object.assign({}, base), { grupo: 'GTU,VLT' }), 5);
    console.log('exportar', e.length);
    await ds.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
//# sourceMappingURL=tmp-g.js.map