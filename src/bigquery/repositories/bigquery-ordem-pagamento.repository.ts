import { Injectable, Logger } from '@nestjs/common';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { TipoFavorecidoEnum } from 'src/tipo-favorecido/tipo-favorecido.enum';
import { logWarn } from 'src/utils/log-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { BQSInstances, BigqueryService } from '../bigquery.service';
import { BigqueryOrdemPagamento } from '../entities/ordem-pagamento.bigquery-entity';
import { IBigqueryFindOrdemPagamento } from '../interfaces/bigquery-find-ordem-pagamento.interface';
import { bigToNumber } from 'src/utils/pipe-utils';

@Injectable()
export class BigqueryOrdemPagamentoRepository {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoRepository', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
  ) {}

  public async findMany(
    filter?: IBigqueryFindOrdemPagamento,
  ): Promise<BigqueryOrdemPagamento[]> {
    const transacoes: BigqueryOrdemPagamento[] = (await this.queryData(filter))
      .data;
    return transacoes;
  }

  public async query(
    sql: string,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    // TODO: remover tipoFavorecido
    const queryResult = await this.bigqueryService.query(
      BQSInstances.smtr,
      sql,
    );
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private async queryData(
    args?: IBigqueryFindOrdemPagamento,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    // TODO: remover tipoFavorecido
    const qArgs = await this.getQueryArgs(args);
    const query =
      `
      SELECT
        CAST(t.data_ordem AS STRING) AS dataOrdem,
        t.id_consorcio AS idConsorcio,
        t.consorcio AS consorcio,
        t.id_operadora AS idOperadora,
        t.operadora AS operadora,
        t.id_ordem_pagamento AS idOrdemPagamento,
        t.quantidade_transacao_debito AS quantidadeTransacaoDebito,
        t.valor_debito AS valorDebito,
        t.quantidade_transacao_especie AS quantidadeTransacaoEspecie,
        t.valor_especie AS valorEspecie,
        t.quantidade_transacao_gratuidade AS quantidadeTransacaoGratuidade,
        t.valor_gratuidade AS valorGratuidade,
        t.quantidade_transacao_integracao AS quantidadeTransacaoIntegracao,
        t.valor_integracao AS valorIntegracao,
        t.quantidade_transacao_rateio_credito AS quantidadeTransacaoRateioCredito,
        t.valor_rateio_credito AS valorRateioCredito,
        t.quantidade_transacao_rateio_debito AS quantidadeTransacaoRateioDebito,
        t.valor_rateio_debito AS valorRateioDebito,
        t.valor_total_transacao_bruto AS valorTotalTransacaoBruto,
        t.valor_desconto_taxa AS valorDescontoTaxa,
        t.valor_total_transacao_liquido AS valorTotalTransacaoLiquido,
        t.versao AS versao,
        CAST(c.cnpj AS STRING) AS consorcioCnpj,
        CAST(o.documento AS STRING) AS operadoraCpfCnpj,
      FROM \`${qArgs.ordemPagamento}\` t
      ${qArgs.joinConsorcios}
      ${qArgs.joinOperadoras}\n` +
      (qArgs.qWhere.length ? `WHERE ${qArgs.qWhere}\n` : '') +
      '\nORDER BY dataOrdem ASC, idConsorcio ASC\n' +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.query(
      BQSInstances.smtr,
      query,
    );
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      i.valorDebito = bigToNumber(i.valorDebito);
      i.valorDescontoTaxa = bigToNumber(i.valorDescontoTaxa);
      i.valorEspecie = bigToNumber(i.valorEspecie);
      i.valorGratuidade = bigToNumber(i.valorGratuidade);
      i.valorIntegracao = bigToNumber(i.valorIntegracao);
      i.valorRateioCredito = bigToNumber(i.valorRateioCredito);
      i.valorRateioDebito = bigToNumber(i.valorRateioDebito);
      i.valorTotalTransacaoBruto = bigToNumber(i.valorTotalTransacaoBruto);
      i.valorTotalTransacaoLiquido = bigToNumber(i.valorTotalTransacaoLiquido);
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private async getQueryArgs(args?: IBigqueryFindOrdemPagamento) {
    const IS_BQ_PROD =
      (
        await this.settingsService.getOneBySettingData(
          appSettings.any__bigquery_env,
          true,
        )
      ).getValueAsString() === BigqueryEnvironment.Production;
    const Q_CONSTS = {
      bucket: IS_BQ_PROD ? 'rj-smtr' : 'rj-smtr-dev',
      ordemPagamento: IS_BQ_PROD
        ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.ordem_pagamento_consorcio_operador_dia'
        : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem.ordem_pagamento_consorcio_operador_dia',
      tTipoPgto: IS_BQ_PROD ? 'tipo_pagamento' : 'id_tipo_pagamento',
      favorecidoCpfCnpj: 'NULL',
      tipoFavorecido: `CASE WHEN o.tipo_documento = 'CPF' THEN NULL ELSE ${TipoFavorecidoEnum.vanzeiro} END`,
    };

    // Args
    let offset = args?.offset;
    if (args?.offset !== undefined && args.limit === undefined) {
      logWarn(
        this.logger,
        "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." +
          " 'offset' will be ignored to prevent query fail",
      );
      offset = undefined;
    }

    const queryBuilderDate = new QueryBuilder();
    queryBuilderDate.pushOR();
    if (args?.startDate) {
      const startDate = args.startDate.toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) >= DATE('${startDate}')`);
    }
    if (args?.endDate) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) <= DATE('${endDate}')`);
    }
    if (args?.previousDaysOnly === true) {
      queryBuilderDate.pushAND(
        'DATE(t.data_ordem) > DATE(t.datetime_transacao)',
      );
    }

    queryBuilderDate.pushOR();
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilderDate.pushAND(`DATE(t.data_ordem) = DATE('${nowStr}')`);
    }

    const queryBuilder = new QueryBuilder();
    queryBuilder.pushAND(queryBuilderDate.toSQL());

    if (args?.ignoreTransacaoLiquidoZero) {
      queryBuilder.pushAND(`t.valor_total_transacao_liquido > 0`);
    }

    // We dont use this filter
    if (args?.cpfCnpj !== undefined) {
      if (args?.tipoFavorecido === TipoFavorecidoEnum.vanzeiro) {
        queryBuilder.pushAND(`o.documento = ${args.cpfCnpj}`);
      } else {
        queryBuilder.pushAND(
          `(o.documento = ${args.cpfCnpj} OR c.cnpj = ${args.cpfCnpj})`,
        );
      }
    } else {
      if (args?.tipoFavorecido === TipoFavorecidoEnum.vanzeiro) {
        queryBuilder.pushAND(`o.tipo_documento = 'CPF'`);
      } else {
        queryBuilder.pushAND(
          `(o.tipo_documento = 'CNPJ' OR c.cnpj IS NOT NULL)`,
        );
      }
    }

    /**
     * Temporary filter.
     *
     * CPF 102.041.537-19   Permissão 46.357288-9
     *
     * CPF 038.184.294-05   Permissão 46.341637-2
     */
    // consorcio +  operadora
    // null         valor
    // valor        null
    // valor        valor
    // queryBuilder.pushAND(`o.documento IN ('463572889', '463416372')`);

    // WIP: Permitir todos os consórcios - 16/05/2024
    // queryBuilder.pushAND(
    //   `t.consorcio IN ("VLT", "Internorte", "MobiRio", "Santa Cruz")`,
    // );

    const qWhere = queryBuilder.toSQL();

    // Query
    const joinOperadoras = `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora `;
    const joinConsorcios = `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio `;

    return {
      qWhere,
      bucket: Q_CONSTS.bucket,
      ordemPagamento: Q_CONSTS.ordemPagamento,
      tTipoPgto: Q_CONSTS.tTipoPgto,
      joinOperadoras: joinOperadoras,
      joinConsorcios: joinConsorcios,
      tipoFavorecido: Q_CONSTS.tipoFavorecido,
      offset,
      limit: args?.limit,
    };
  }
}
