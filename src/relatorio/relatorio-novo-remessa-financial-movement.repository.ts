import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { RelatorioFinancialMovementNovoRemessaDto, RelatorioFinancialMovementNovoRemessaData } from './dtos/relatorio-pay-and-pending-novo-remessa.dto';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from './interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { StatusPagamento } from './enum/statusRemessafinancial-movement';

@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private static readonly queryNewReport = `
SELECT DISTINCT 
    da."dataVencimento" AS dataPagamento,
    pu."fullName" AS nomes,
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
  inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
  inner join header_lote hl on hl."id" = da."headerLoteId"
  inner join header_arquivo ha on ha."id" = hl."headerArquivoId"
  /* extra joins */
where da."dataVencimento" between $1 and $2
  and ($4::text[] is null or TRIM(UPPER(it."nomeConsorcio")) = any($4))
  and ($5::integer[] is null or it."clienteFavorecidoId" = any($5))
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

`;

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
      this.logger.log("Conectado com sucesso.");

      let allResults: any[] = [];

      if (queryDecision.requiresMerge) {
        this.logger.log("Executando queries separadas por ano.");
        const actualDataFim = filter.dataFim
        filter.dataFim = new Date("2024-12-31T00:00:00.000Z")

        const paramsFor2024 = this.getParametersByQuery(2024, filter);
        let finalQuery2024 = RelatorioNovoRemessaFinancialMovementRepository.queryOlderReport;

        if (filter.todosVanzeiros) {
          finalQuery2024 += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2024}`;
        }

        if (filter.eleicao && initialYear === 2024) {
          finalQuery2024 += eleicaoExtraFilter;
          finalQuery2024.replace('/* extra joins */', eleicaoInnerJoin)
        } else if (initialYear === 2024) {
          finalQuery2024 += notEleicaoFilter2024
        }

        const resultFrom2024 = await queryRunner.query(finalQuery2024, paramsFor2024);

        filter.dataFim = actualDataFim
        filter.dataInicio = new Date("2025-01-01T00:00:00.000Z")
        const yearForNewQuery = finalYear >= 2025 ? finalYear : 2025;
        const paramsForNewerYears = this.getParametersByQuery(yearForNewQuery, filter);
        let finalQuery2025 = RelatorioNovoRemessaFinancialMovementRepository.queryNewReport;

        if (filter.todosVanzeiros) {
          finalQuery2025 += ` ${RelatorioNovoRemessaFinancialMovementRepository.notCpf2025} `;
        }

        const resultFromNewerYears = await queryRunner.query(finalQuery2025, paramsForNewerYears);

        allResults = [...resultFrom2024, ...resultFromNewerYears];

      } else {
        const paramsForYear = this.getParametersByQuery(initialYear, filter);

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
          finalQuery.replace('/* extra joins */', eleicaoInnerJoin)
        } else if (initialYear === 2024) {
          finalQuery += notEleicaoFilter2024
        }

        allResults = await queryRunner.query(finalQuery, paramsForYear);
      }


      console.log(allResults)
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

      console.log()

      const relatorioDto = new RelatorioFinancialMovementNovoRemessaDto({
        count,
        valor: Number.parseFloat(valorTotal.toString()),
        valorPago,
        valorEstornado,
        valorRejeitado,
        valorAguardandoPagamento,
        data: allResults
          .sort((a, b) => {
            const statusOrder = { Estorno: 0, Pago: 1, Rejeitado: 2 };
            const dateA = new Date(a.datapagamento).getTime();
            const dateB = new Date(b.datapagamento).getTime();
            if (dateA !== dateB) return dateA - dateB;
            const nameCompare = a.nomes.localeCompare(b.nomes, 'pt-BR');
            if (nameCompare !== 0) return nameCompare;
            return statusOrder[a.status] - statusOrder[b.status];
          })
          .map(r => new RelatorioFinancialMovementNovoRemessaData({
            dataPagamento: new Intl.DateTimeFormat('pt-BR').format(new Date(r.datapagamento)),
            nomes: r.nomes,
            cpfCnpj: r.cpfCnpj,
            consorcio: r.nomeConsorcio,
            valor: Number.parseFloat(r.valor),
            status: r.status
          }))
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
  }): string[] | null {
    const statuses: string[] = [];

    const statusMappings: { condition: boolean | undefined; statuses: StatusPagamento[] }[] = [
      { condition: filter.pago, statuses: [StatusPagamento.PAGO] },
      { condition: filter.erro, statuses: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO] },
      { condition: filter.estorno, statuses: [StatusPagamento.ERRO_ESTORNO] },
      { condition: filter.rejeitado, statuses: [StatusPagamento.ERRO_REJEITADO] },
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