import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 92;

@Injectable()
export class ReconciliacaoService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Recalcula o lado do banco (contagem e soma por dia de captura) das linhas já reconciliadas. O lado do
   * BigQuery permanece o da última sincronização que cobriu o dia; a diferença é refeita.
   */
  async recalcularBanco(dataInicio: string, dataFim: string) {
    if (!DATA.test(dataInicio ?? '') || !DATA.test(dataFim ?? '') || dataFim < dataInicio) {
      throw new HttpException({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const dias = (Date.parse(dataFim) - Date.parse(dataInicio)) / 86400000 + 1;
    if (dias > MAX_DIAS) {
      throw new HttpException({ error: `Período máximo de ${MAX_DIAS} dias.` }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const atualizadas = await this.dataSource.query(
      `WITH banco AS (
         SELECT "dataCaptura"::date AS dia, count(*)::int AS qtd, COALESCE(sum(valor), 0)::numeric(18,2) AS valor
           FROM ordem_pagamento
          WHERE "dataCaptura" >= $1::date AND "dataCaptura" < ($2::date + 1)
          GROUP BY 1)
       UPDATE ordem_pagamento_reconciliacao_diaria r
          SET bd_qtd = COALESCE(b.qtd, 0), bd_valor = COALESCE(b.valor, 0),
              dif_qtd = r.bq_qtd - COALESCE(b.qtd, 0), dif_valor = ROUND(r.bq_valor - COALESCE(b.valor, 0), 2),
              calculado_em = now()
         FROM (SELECT d::date AS dia FROM generate_series($1::date, $2::date, interval '1 day') d) x
         LEFT JOIN banco b ON b.dia = x.dia
        WHERE r.data = x.dia
        RETURNING r.data`,
      [dataInicio, dataFim],
    );
    return { atualizadas: Array.isArray(atualizadas?.[0]) ? atualizadas[0].length : atualizadas.length };
  }
}
