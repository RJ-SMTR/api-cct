import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaDto } from '../dtos/relatorio-financial-and-movement.dto';


@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private readonly queryNewReport = `
SELECT DISTINCT 
    da."dataVencimento" AS "dataReferencia",
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    op."nomeConsorcio",
    da."valorLancamento" AS valor,
    opa."dataPagamento",
    CASE
    		WHEN oph."statusRemessa" = 6 THEN 'Pendancia Paga'  
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
    		        WHEN oph."statusRemessa" = 6 THEN 'Pendancia Paga'  
    		        WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'  
                WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                ELSE 'Rejeitado'
            END
        ) = ANY($4)
    )
    and oph."motivoStatusRemessa" not in ('AM')
`;

  private readonly queryOlderReport = `
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
    		  WHEN oph."statusRemessa" = 6 THEN 'Pendancia Paga'  
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
    		        WHEN oph."statusRemessa" = 6 THEN 'Pendancia Paga'  
    		        WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'  
                WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
                WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
                ELSE 'Rejeitado'
            END
        ) = ANY($4)
    )
  `


  private notCpf2025 = `AND pu."cpfCnpj" NOT IN ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )`
  private notCpf2024 = `AND cf."cpfCnpj" NOT IN ('18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )`

  private pendentes_25 = `
UNION ALL

SELECT
  DATE(op."dataOrdem") AS dataPagamento,
  op."nomeOperadora" as nomes,
	pu.email,
  pu."bankCode" AS "codBanco",
  bc.name AS "nomeBanco",
	pu."cpfCnpj",
	op."nomeConsorcio",
  op."valor" AS valor,
  op."dataOrdem",
  'Pendente' AS status
FROM ordem_pagamento op
INNER JOIN public."user" pu ON pu.id = op."userId"
JOIN bank bc on bc.code = pu."bankCode"
WHERE
    op."dataOrdem" BETWEEN $1  AND $2 
    AND op."ordemPagamentoAgrupadoId" IS NULL
    AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
    AND op."nomeConsorcio" IN ('SPTC', 'STPL', 'TEC')
    AND (
        ($6::numeric IS NULL OR op."valor" >= $6::numeric) 
        AND ($7::numeric IS NULL OR op."valor" <= $7::numeric)
    )
`

  private pendentes_24 = `
UNION ALL

SELECT DISTINCT 
    DATE(it."dataOrdem") AS dataPagamento,
    uu."fullName" nome,
    uu.email,
    uu."bankCode" as "codBanco",
    bc.name AS "nomeBanco",
    uu."cpfCnpj",
    it."nomeConsorcio" AS consorcio,
    it."valor" AS valor,
    uu.id,
	'Pendente' AS status,
   NULL::boolean
from item_transacao it 
        left join public.user uu on uu."permitCode"=it."idOperadora"
		    JOIN bank bc on bc.code = uu."bankCode"
        where it."dataOrdem" BETWEEN $1 AND $2
        and it."nomeConsorcio" in('STPC','STPL','TEC')
        AND ($5::integer[] IS NULL OR uu."id" = ANY($5::integer[]))
        AND (
         ($6::numeric IS NULL OR it."valor" >= $6::numeric) 
         AND ($7::numeric IS NULL OR it."valor" <= $7::numeric)
       )
        and not exists
          (
            select 1 from detalhe_a da 
                      where da."itemTransacaoAgrupadoId"=it."itemTransacaoAgrupadoId"
          )
`

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaFinancialMovementRepository.name, { timestamp: true });

  public async findFinancialMovement(filter: IFindPublicacaoRelatorioNovoFinancialMovement): Promise<RelatorioFinancialMovementNovoRemessaDto> {
    const initialYear = filter.dataInicio.getFullYear();
    const finalYear = filter.dataFim.getFullYear();

    const queryDecision = this.getQueryByYear(initialYear, finalYear);

    const eleicaoInnerJoin = `
      INNER JOIN ordem_pagamento_unico opu ON opu."operadoraCpfCnpj" = cf."cpfCnpj"
      `
    const eleicaoExtraFilter = ` 
    AND ita."idOrdemPagamento" LIKE '%U%'
    `
    const notEleicaoFilter2024 = `  
    AND ita."idOrdemPagamento" NOT LIKE '%U%'
    `
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();

      let allResults: any[] = [];

      if (queryDecision.requiresMerge) {
        this.logger.log("Executando queries separadas por ano.");
        const actualDataFim = filter.dataFim
        filter.dataFim = new Date("2024-12-31T00:00:00.000Z")

        const paramsFor2024 = this.getParametersByQuery(2024, filter);
        let finalQuery2024 = this.queryOlderReport;

        if (filter.todosVanzeiros) {
          finalQuery2024 += ` ${this.notCpf2024}`;
        }

        const is2024 = initialYear === 2024

        if (is2024 && filter.eleicao) {
          finalQuery2024 += eleicaoExtraFilter;
          finalQuery2024.replace('/* extra joins */', eleicaoInnerJoin)
        } else if (is2024) {
          finalQuery2024 += notEleicaoFilter2024
        }

        if (filter.desativados) {
          finalQuery2024 += `AND pu.bloqueado = true`

        }

        if (filter.pendentes && is2024) {
          finalQuery2024 += this.pendentes_24
        }

        const resultFrom2024 = await queryRunner.query(finalQuery2024, paramsFor2024);

        filter.dataFim = actualDataFim
        filter.dataInicio = new Date("2025-01-01T00:00:00.000Z")
        const yearForNewQuery = finalYear >= 2025 ? finalYear : 2025;
        const paramsForNewerYears = this.getParametersByQuery(yearForNewQuery, filter);
        let finalQuery2025 = this.queryNewReport;

        if (filter.todosVanzeiros) {
          finalQuery2025 += ` ${this.notCpf2025} `;
        }


        const is2025 = actualDataFim.getFullYear() === 2025
        if (is2025 && filter.eleicao) {
          finalQuery2025 = this.eleicao2025
        }

        if (filter.pendentes && is2025) {
          finalQuery2025 += this.pendentes_25
        }


        const resultFromNewerYears = await queryRunner.query(finalQuery2025, paramsForNewerYears);

        allResults = [...resultFrom2024, ...resultFromNewerYears];

      } else {
        const paramsForYear = this.getParametersByQuery(initialYear, filter);
        const is2024 = initialYear === 2024
        const is2025 = initialYear === 2025


        let finalQuery = queryDecision.query;

        if (filter.todosVanzeiros) {
          if (is2025) {
            finalQuery += ` ${this.notCpf2025} `;
          } else if (initialYear === 2024) {
            finalQuery += ` ${this.notCpf2024} `;
          }
        }

        if (is2024 && filter.eleicao) {
          finalQuery += eleicaoExtraFilter;
          finalQuery.replace('/* extra joins */', eleicaoInnerJoin)
        } else if (is2024) {
          finalQuery += notEleicaoFilter2024
        }

        if (filter.eleicao && is2025) {
          finalQuery = this.eleicao2025
        }

        if (filter.desativados) {
          finalQuery += ` AND pu.bloqueado = true`;
        }

        if (filter.pendentes && is2025) {
          finalQuery += this.pendentes_25
        }

        if (filter.pendentes && is2024) {
          finalQuery += this.pendentes_24
        }

        allResults = await queryRunner.query(finalQuery, paramsForYear);
      }

      const count = allResults.length;
      const { valorTotal, valorPago, valorRejeitado, valorEstornado, valorAguardandoPagamento, valorPendente, valorPendenciaPaga } = allResults.reduce(
        (acc, curr) => {
          const valor = Number.parseFloat(curr.valor);
          acc.valorTotal += valor;

          if (curr.status === "Pago") acc.valorPago += valor;
          else if (curr.status === "Rejeitado") acc.valorRejeitado += valor;
          else if (curr.status === "Estorno") acc.valorEstornado += valor;
          else if (curr.status === "Aguardando Pagamento") acc.valorAguardandoPagamento += valor;
          else if (curr.status === "Pendente") acc.valorPendente += valor;
          else if (curr.status === "Pendencia Paga") acc.valorPendenciaPaga += valor;

          return acc;
        },
        {
          valorTotal: 0,
          valorPago: 0,
          valorRejeitado: 0,
          valorEstornado: 0,
          valorAguardandoPagamento: 0,
          valorPendente: 0,
          valorPendenciaPaga: 0
        }
      );

      const grouped = new Map<string, {
        dataReferencia: string;
        nomes: string;
        cpfCnpj: string;
        email: string,
        codBanco: number;
        nomeBanco: string,
        consorcio: string;
        valor: number;
        status: string;
        dataPagamento: string
      }>();

      for (const r of allResults) {
        const dataReferencia = new Intl.DateTimeFormat('pt-BR').format(new Date(r.dataReferencia));
        const key = `${dataReferencia}|${r.cpfCnpj}`;
        const dataPagamento = new Intl.DateTimeFormat('pt-BR').format(new Date(r.dataPagamento));

        if (grouped.has(key)) {
          const existing = grouped.get(key)!;
          existing.valor += Number.parseFloat(r.valor);
        } else {
          grouped.set(key, {
            dataReferencia,
            nomes: r.nomes,
            email: r.email,
            codBanco: r.codBanco,
            nomeBanco: r.nomeBanco,
            cpfCnpj: r.cpfCnpj,
            consorcio: r.nomeConsorcio,
            valor: Number.parseFloat(r.valor),
            status: r.status,
            dataPagamento
          });
        }
      }

      const dataOrdenada = Array.from(grouped.values())
        .sort((a, b) => {
          const dateA = new Date(a.dataReferencia.split('/').reverse().join('-')).getTime();
          const dateB = new Date(b.dataReferencia.split('/').reverse().join('-')).getTime();
          const nameCompare = a.nomes.localeCompare(b.nomes, 'pt-BR');
          if (dateA !== dateB) return dateA - dateB;
          return nameCompare;
        })
        .map(r => new RelatorioFinancialMovementNovoRemessaData({
          dataReferencia: r.dataReferencia,
          nomes: r.nomes,
          email: r.email,
          codBanco: r.codBanco,
          nomeBanco: r.nomeBanco,
          cpfCnpj: r.cpfCnpj,
          consorcio: r.consorcio,
          valor: r.valor,
          status: r.status,
          dataPagamento: r.dataPagamento,
        }));

      const relatorioDto = new RelatorioFinancialMovementNovoRemessaDto({
        count,
        valor: Number.parseFloat(valorTotal.toString()),
        valorPago,
        valorEstornado,
        valorRejeitado,
        valorAguardandoPagamento,
        valorPendente,
        valorPendenciaPaga,
        data: dataOrdenada,
      });

      return relatorioDto;
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
    pendenciaPaga?: boolean;
    pendentes?: boolean;
  }): string[] | null {
    const statuses: string[] = [];

    const statusMappings: { condition: boolean | undefined; statuses: StatusPagamento[] }[] = [
      { condition: filter.pago, statuses: [StatusPagamento.PAGO] },
      { condition: filter.erro, statuses: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO, StatusPagamento.PENDENTES] },
      { condition: filter.estorno, statuses: [StatusPagamento.ERRO_ESTORNO] },
      { condition: filter.rejeitado, statuses: [StatusPagamento.ERRO_REJEITADO] },
      { condition: filter.emProcessamento, statuses: [StatusPagamento.AGUARDANDO_PAGAMENTO] },
      { condition: filter.pendenciaPaga, statuses: [StatusPagamento.PENDENCIA_PAGA] },
      { condition: filter.pendentes, statuses: [StatusPagamento.PENDENTES] }
    ];


    for (const mapping of statusMappings) {
      if (mapping.condition) {
        statuses.push(...mapping.statuses);
      }
    }
    console.log(statuses)

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
      return { requiresMerge: false, query: this.queryOlderReport };
    }

    if (initialYear >= newerYearStart && finalYear >= newerYearStart) {
      return { requiresMerge: false, query: this.queryNewReport };
    }

    return { requiresMerge: true };
  }



  private getParametersByQuery(year: number, filter: IFindPublicacaoRelatorioNovoFinancialMovement): any[] {
    const consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(nome => nome.toUpperCase().trim())
      : null;


    const {
      dataInicio,
      dataFim,
      userIds,
      valorMin,
      valorMax,
    } = filter;

    if (year === 2024) {
      return [
        dataInicio || null, // $1
        dataFim || null, // $2
        this.getStatusParaFiltro(filter) || null,// $3
        consorcioNome || null, //$4
        userIds || null, // $5
        valorMin || null, // $6
        valorMax || null, // $7
      ];
    }

    return [
      dataInicio || null, //$1
      dataFim || null, //$2
      userIds || null, // $3
      this.getStatusParaFiltro(filter) || null, // $4
      consorcioNome || null, // $5
      valorMin || null, // $6
      valorMax || null, // $7
    ];
  }


}
