import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaDto } from '../dtos/relatorio-financial-and-movement.dto';
import { IPagination } from '../interfaces/pagination';


@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private static readonly queryNewReport = `
SELECT DISTINCT 
    da."dataVencimento" AS dataPagamento,
    pu."fullName" AS nomes,
      pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    op."nomeConsorcio",
    da."valorLancamento" AS valor,
    CASE
    		WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'  
        WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
        WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno' 
        ELSE 'Rejeitado'
    END AS status
FROM
    ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
    INNER JOIN public."user" pu ON pu."id" = op."userId"
          JOIN bank bc on bc.code = pu."bankCode"
WHERE
    da."dataVencimento" BETWEEN $1 AND $2
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND ($5::text[] IS NULL OR TRIM(UPPER(op."nomeConsorcio")) = ANY($5))
    AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
    )
    AND (
        $4::text[] IS NULL OR (
            CASE 
    		        WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'  
                WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                ELSE 'Rejeitado'
            END
        ) = ANY($4)
    )
    and oph."motivoStatusRemessa" not in ('AM')
`;

  private static readonly queryOlderReport = `
select distinct 
  da."dataVencimento" as dataPagamento,
  cf."nome" as nomes,
     pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
  cf."cpfCnpj",
  ita."nomeConsorcio",
  da."valorLancamento" as valor,
  ita.id,
  case 
    when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago" = true then 'Pago'
    when da."ocorrenciasCnab" = '02' then 'Estorno'
    else 'Rejeitado'
  end as status,
  ap."isPago"
from item_transacao it 
  inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId" = ita."id"
  inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id
  inner join cliente_favorecido cf on cf.id = it."clienteFavorecidoId"
  inner join public.user pu on pu."cpfCnpj" = cf."cpfCnpj"
  inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
  inner join header_lote hl on hl."id" = da."headerLoteId"
  inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
      JOIN bank bc on bc.code = pu."bankCode"
  /* extra joins */
where da."dataVencimento" between $1 and $2
  and ($4::text[] is null or TRIM(UPPER(it."nomeConsorcio")) = any($4))
  AND ($5::integer[] IS NULL OR pu."id" = ANY($5))
  and (
    ($6::numeric is null or da."valorLancamento" >= $6::numeric) and
    ($7::numeric is null or da."valorLancamento" <= $7::numeric)
  )
  AND TRIM(da."ocorrenciasCnab") <> ''
	AND ha."status" <> '5'
  and (
    $3::text[] is null or (
      case 
        when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago" = true then 'Pago'
        when da."ocorrenciasCnab" = '02' then 'Estorno'
        else 'Rejeitado'
      end
    ) = any($3)
  ) 
  and da."ocorrenciasCnab" <> 'AM'
`;

  private eleicao2025 = `
  SELECT DISTINCT
      da."dataVencimento" AS dataPagamento,
      pu."fullName" AS nomes,
         pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
      pu."cpfCnpj",
	    opu."consorcio" AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      CASE
          WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
          WHEN oph."motivoStatusRemessa" IN ('00', 'BD')
          OR oph."statusRemessa" = 3 THEN 'Pago'
          WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
          ELSE 'Rejeitado'
      END AS status
  FROM
    ordem_pagamento_agrupado opa 
      INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
      inner join ordem_pagamento_unico opu on opu."idOrdemPagamento" = opa.id::VARCHAR
      inner join public."user" pu on pu."cpfCnpj" = opu."operadoraCpfCnpj"
       JOIN bank bc on bc.code = pu."bankCode"
  WHERE
      da."dataVencimento" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
      AND ($5::text[] IS NULL OR TRIM(UPPER(opu."consorcio")) = ANY($5))
      AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
      )
    AND (
        $4::text[] IS NULL OR (
            CASE 
    		        WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'  
                WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                ELSE 'Rejeitado'
            END
        ) = ANY($4)
    )
  `


  private static notCpf2025 = `AND pu."cpfCnpj" NOT IN ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )`
  private static notCpf2024 = `AND cf."cpfCnpj" NOT IN ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )`

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaFinancialMovementRepository.name, { timestamp: true });


  public async findFinancialMovement(
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
    pagination: IPagination
  ): Promise<RelatorioFinancialMovementNovoRemessaDto> {
    const initialYear = filter.dataInicio.getFullYear();
    const finalYear = filter.dataFim.getFullYear();

    const queryDecision = this.getQueryByYear(initialYear, finalYear);

    const eleicaoInnerJoin = `
    INNER JOIN ordem_pagamento_unico opu ON opu."operadoraCpfCnpj" = cf."cpfCnpj"
  `;
    const eleicaoExtraFilter = ` 
    AND ita."idOrdemPagamento" LIKE '%U%'
  `;
    const notEleicaoFilter2024 = `  
    AND ita."idOrdemPagamento" NOT LIKE '%U%'
  `;

    const paginationSQL = `
    /* pagination */
    LIMIT $8
    OFFSET ($9 - 1) * $8
  `;

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();

      let allResults: any[] = [];

      if (queryDecision.requiresMerge) {
        this.logger.log("Executando queries separadas por ano.");

        const actualDataFim = filter.dataFim;
        filter.dataFim = new Date("2024-12-31T00:00:00.000Z");

        const paramsFor2024 = this.getParametersByQuery(2024, filter, pagination);
        let finalQuery2024 = RelatorioNovoRemessaFinancialMovementRepository.queryOlderReport;

        if (filter.todosVanzeiros) {
          finalQuery2024 += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2024}`;
        }

        if (filter.eleicao && initialYear === 2024) {
          finalQuery2024 += eleicaoExtraFilter;
          finalQuery2024 = finalQuery2024.replace('/* extra joins */', eleicaoInnerJoin);
        } else if (initialYear === 2024) {
          finalQuery2024 += notEleicaoFilter2024;
        }

        // Adiciona a paginação
        finalQuery2024 += paginationSQL;

        const resultFrom2024 = await queryRunner.query(finalQuery2024, paramsFor2024);

        filter.dataFim = actualDataFim;
        filter.dataInicio = new Date("2025-01-01T00:00:00.000Z");
        const yearForNewQuery = finalYear >= 2025 ? finalYear : 2025;
        const paramsForNewerYears = this.getParametersByQuery(yearForNewQuery, filter, pagination);

        let finalQuery2025 = RelatorioNovoRemessaFinancialMovementRepository.queryNewReport;

        if (filter.todosVanzeiros) {
          finalQuery2025 += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2025} `;
        }

        if (filter.eleicao && actualDataFim.getFullYear() === 2025) {
          finalQuery2025 = this.eleicao2025;
        }

        finalQuery2025 += paginationSQL;

        const resultFromNewerYears = await queryRunner.query(finalQuery2025, paramsForNewerYears);

        allResults = [...resultFrom2024, ...resultFromNewerYears];
      } else {
        const paramsForYear = this.getParametersByQuery(initialYear, filter, pagination);

        let finalQuery = queryDecision.query;

        if (filter.todosVanzeiros) {
          if (initialYear === 2025) {
            finalQuery += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2025} `;
          } else if (initialYear === 2024) {
            finalQuery += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2024} `;
          }
        }

        if (filter.eleicao && initialYear === 2024) {
          finalQuery += eleicaoExtraFilter;
          finalQuery = finalQuery.replace('/* extra joins */', eleicaoInnerJoin);
        } else if (initialYear === 2024) {
          finalQuery += notEleicaoFilter2024;
        }

        if (filter.eleicao && initialYear === 2025) {
          finalQuery = this.eleicao2025;
        }

        finalQuery += paginationSQL;

        allResults = await queryRunner.query(finalQuery, paramsForYear);
      }

      const count = allResults.length;
      const { valorTotal, valorPago, valorRejeitado, valorEstornado, valorAguardandoPagamento } = allResults.reduce(
        (acc, curr) => {
          const valor = Number.parseFloat(curr.valor);
          acc.valorTotal += valor;

          if (curr.status === "Pago") acc.valorPago += valor;
          else if (curr.status === "Rejeitado") acc.valorRejeitado += valor;
          else if (curr.status === "Estorno") acc.valorEstornado += valor;
          else if (curr.status === "Aguardando Pagamento") acc.valorAguardandoPagamento += valor;

          return acc;
        },
        {
          valorTotal: 0,
          valorPago: 0,
          valorRejeitado: 0,
          valorEstornado: 0,
          valorAguardandoPagamento: 0,
        }
      );

      const grouped = new Map<string, {
        dataPagamento: string;
        nomes: string;
        cpfCnpj: string;
        email: string;
        codBanco: number;
        nomeBanco: string;
        consorcio: string;
        valor: number;
        status: string;
      }>();

      for (const r of allResults) {
        const dataPagamento = new Intl.DateTimeFormat('pt-BR').format(new Date(r.datapagamento));
        const key = `${dataPagamento}|${r.nomes}`;

        if (grouped.has(key)) {
          const existing = grouped.get(key)!;
          existing.valor += Number.parseFloat(r.valor);
        } else {
          grouped.set(key, {
            dataPagamento,
            nomes: r.nomes,
            email: r.email,
            codBanco: r.codBanco,
            nomeBanco: r.nomeBanco,
            cpfCnpj: r.cpfCnpj,
            consorcio: r.nomeConsorcio,
            valor: Number.parseFloat(r.valor),
            status: r.status,
          });
        }
      }

      const dataOrdenada = Array.from(grouped.values())
        .sort((a, b) => {
          const dateA = new Date(a.dataPagamento.split('/').reverse().join('-')).getTime();
          const dateB = new Date(b.dataPagamento.split('/').reverse().join('-')).getTime();
          const nameCompare = a.nomes.localeCompare(b.nomes, 'pt-BR');
          if (dateA !== dateB) return dateA - dateB;
          return nameCompare;
        })
        .map(r => new RelatorioFinancialMovementNovoRemessaData({
          dataPagamento: r.dataPagamento,
          nomes: r.nomes,
          email: r.email,
          codBanco: r.codBanco,
          nomeBanco: r.nomeBanco,
          cpfCnpj: r.cpfCnpj,
          consorcio: r.consorcio,
          valor: r.valor,
          status: r.status,
        }));

      return new RelatorioFinancialMovementNovoRemessaDto({
        page: pagination.page,
        count,
        valor: Number.parseFloat(valorTotal.toString()),
        valorPago,
        valorEstornado,
        valorRejeitado,
        valorAguardandoPagamento,
        data: dataOrdenada,
      });

    } catch (error) {
      this.logger.log("Erro ao executar a query:", error);
      throw error;
    } finally {
      await queryRunner.release();
      this.logger.log("QueryRunner liberado.");
    }
  }




  private getStatusParaFiltro(filter: {
    pago?: boolean;
    erro?: boolean;
    estorno?: boolean;
    rejeitado?: boolean;
    emProcessamento?: boolean;
  }): string[] | null {
    const statuses: string[] = [];

    const statusMappings: { condition: boolean | undefined; statuses: StatusPagamento[] }[] = [
      { condition: filter.pago, statuses: [StatusPagamento.PAGO] },
      { condition: filter.erro, statuses: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO] },
      { condition: filter.estorno, statuses: [StatusPagamento.ERRO_ESTORNO] },
      { condition: filter.rejeitado, statuses: [StatusPagamento.ERRO_REJEITADO] },
      { condition: filter.emProcessamento, statuses: [StatusPagamento.AGUARDANDO_PAGAMENTO] }
    ];

    for (const mapping of statusMappings) {
      if (mapping.condition) {
        statuses.push(...mapping.statuses);
      }
    }

    return statuses.length > 0 ? statuses : null;
  }


  private getQueryByYear(initialYear: number, finalYear: number):
    | { requiresMerge: true }
    | { requiresMerge: false; query: string } {
    const olderYearLimit = 2024;
    const newerYearStart = 2025;

    if (initialYear <= olderYearLimit && finalYear >= newerYearStart) {
      return { requiresMerge: true };
    }

    if (initialYear <= olderYearLimit && finalYear <= olderYearLimit) {
      return { requiresMerge: false, query: RelatorioNovoRemessaFinancialMovementRepository.queryOlderReport };
    }

    if (initialYear >= newerYearStart && finalYear >= newerYearStart) {
      return { requiresMerge: false, query: RelatorioNovoRemessaFinancialMovementRepository.queryNewReport };
    }

    return { requiresMerge: true };
  }



  private getParametersByQuery(
    year: number,
    filter: IFindPublicacaoRelatorioNovoFinancialMovement,
    pagination: IPagination
  ): any[] {
    const consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(nome => nome.toUpperCase().trim())
      : null;

    const { dataInicio, dataFim, userIds, valorMin, valorMax } = filter;

    console.log(pagination)

    if (year === 2024) {
      return [
        dataInicio || null, // $1
        dataFim || null,    // $2
        this.getStatusParaFiltro(filter) || null, // $3
        consorcioNome || null, // $4
        userIds || null, // $5
        valorMin || null, // $6
        valorMax || null, // $7
        pagination.limit, // $8
        pagination.page   // $9
      ];
    }

    return [
      dataInicio || null, // $1
      dataFim || null,    // $2
      userIds || null,    // $3
      this.getStatusParaFiltro(filter) || null, // $4
      consorcioNome || null, // $5
      valorMin || null, // $6
      valorMax || null, // $7
      pagination.limit, // $8
      pagination.page   // $9
    ];
  }



}
