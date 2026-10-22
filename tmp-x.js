"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const extrato_dashboard_service_1 = require("./src/cnab/service/extrato/extrato-dashboard.service");
(async () => {
    if (process.env.DATABASE_HOST !== 'localhost')
        throw new Error('nao local');
    const ds = new typeorm_1.DataSource({ type: 'postgres', host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
    await ds.initialize();
    const s = new extrato_dashboard_service_1.ExtratoDashboardService(ds);
    const r = await s.resumo({ dataInicio: '2026-01-01', dataFim: '2026-10-31' });
    r.contas.forEach(c => console.log(c.conta, JSON.stringify(c.entradas), JSON.stringify(c.saidas), c.resultado, c.porDia.length, c.porHistorico.length));
    const d = await s.detalhe({ dataInicio: '2026-01-01', dataFim: '2026-10-31', conta: 'cett', tipo: 'C', descricao: 'PIX RECEBIDO', page: 1, pageSize: 2 });
    console.log(d.total, d.entradas, d.saidas, JSON.stringify(d.itens[0]));
    const b = await s.detalhe({ dataInicio: '2026-01-01', dataFim: '2026-10-31', conta: 'bilhetagem', busca: 'pix', pageSize: 1 });
    console.log('busca', b.total);
    console.log((await s.exportar({ dataInicio: '2026-10-01', dataFim: '2026-10-31', conta: 'cett' })).itens.length);
    await s.detalhe({ dataInicio: 'x', dataFim: 'y', conta: 'cett' }).catch(e => console.log('erro ok', e.status));
    await ds.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
//# sourceMappingURL=tmp-x.js.map