import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { StatusPagamento } from './enum/statusRemessaPayAndPending';
import { DataSource } from 'typeorm';
import { RelatorioPayAndPendingNovoRemessaDto, RelatorioPayAndPendingNovoRemessaData } from './dtos/relatorio-pay-and-pending-novo-remessa.dto';
import { IFindPublicacaoRelatorioNovoPayAndPending } from './interfaces/filter-publicacao-relatorio-novo-pay-and-pending.interface';

@Injectable()
export class RelatorioNovoRemessaPayAndPendingRepository {
  private static readonly queryNewReport = `
select distinct 
  da."dataVencimento" as dataPagamento,
  pu."fullName" as nomes,
  pu."cpfCnpj",
  op."nomeConsorcio",
  da."valorLancamento" as valor,
  case 
    when oph."motivoStatusRemessa" = '00' or oph."motivoStatusRemessa" = 'BD' then 'Pago'
    when oph."motivoStatusRemessa" = '02' then 'Estorno'
    else 'Rejeitado'
  end as status
from ordem_pagamento op 
  inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
  inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId" = opa.id
  inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
  inner join public.user pu on pu."id" = op."userId"
where da."dataVencimento" between $1 and $2 
  and ($3::integer[] is null or pu."id" = any($3))
  and ($5::text[] is null or op."nomeConsorcio" = any($5))
  and (
    ($6::numeric is null or da."valorLancamento" >= $6::numeric) and
    ($7::numeric is null or da."valorLancamento" <= $7::numeric)
  )
  and (
  $4::text[] is null or (
    case 
      when oph."motivoStatusRemessa" = '00' or oph."motivoStatusRemessa" = 'BD' then 'Pago'
      when oph."motivoStatusRemessa" = '02' then 'Estorno'
      else 'Rejeitado'
    end
  ) = ANY($4)
)
`;

  private static readonly queryOlderReport = `
select distinct 
  da."dataVencimento" as dataPagamento,
  cf."nome" as nomes,
  cf."cpfCnpj",
  ita."nomeConsorcio",
  da."valorLancamento" as valor,
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
where da."dataVencimento" between $1 and $2
  and ($4::text[] is null or it."nomeConsorcio" = any($4))
  and ($5::integer[] is null or it."clienteFavorecidoId" = any($5))
  and (
    ($6::numeric is null or da."valorLancamento" >= $6::numeric) and
    ($7::numeric is null or da."valorLancamento" <= $7::numeric)
  )
  and (
    $3::text[] is null or (
      case 
        when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago" = true then 'Pago'
        when da."ocorrenciasCnab" = '02' then 'Estorno'
        else 'Rejeitado'
      end
    ) = any($3)
  );
`;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaPayAndPendingRepository.name, { timestamp: true });

  public async findPayAndPending(filter: IFindPublicacaoRelatorioNovoPayAndPending): Promise<RelatorioPayAndPendingNovoRemessaDto> {
    const initialYear = filter.dataInicio.getFullYear();
    const finalYear = filter.dataFim.getFullYear();

    const queryDecision = this.getQueryByYear(initialYear, finalYear);

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      this.logger.log("Conectado com sucesso.");

      let allResults: any[] = [];

      if (queryDecision.requiresMerge) {
        this.logger.log("Executando queries separadas por ano.");
        // Executa query de 2024
        const paramsFor2024 = this.getParametersByQuery(2024, filter);
        const resultFrom2024 = await queryRunner.query(RelatorioNovoRemessaPayAndPendingRepository.queryOlderReport, paramsFor2024);

        // Executa query para o restante (2025 em diante)
        const yearForNewQuery = finalYear >= 2025 ? finalYear : 2025;
        const paramsForNewerYears = this.getParametersByQuery(yearForNewQuery, filter);
        const resultFromNewerYears = await queryRunner.query(RelatorioNovoRemessaPayAndPendingRepository.queryNewReport, paramsForNewerYears);

        allResults = [...resultFrom2024, ...resultFromNewerYears];
      } else {
        const paramsForYear = this.getParametersByQuery(initialYear, filter);
        allResults = await queryRunner.query(queryDecision.query, paramsForYear);
      }

      const count = allResults.length;
      const valorTotal = allResults.reduce((acc, curr) => acc + Number.parseFloat(curr.valor), 0);

      const relatorioDto = new RelatorioPayAndPendingNovoRemessaDto({
        count,
        valor: Number.parseFloat(valorTotal.toString()),
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
          .map(r => new RelatorioPayAndPendingNovoRemessaData({
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
      return { requiresMerge: false, query: RelatorioNovoRemessaPayAndPendingRepository.queryOlderReport };
    }

    if (initialYear >= newerYearStart && finalYear >= newerYearStart) {
      return { requiresMerge: false, query: RelatorioNovoRemessaPayAndPendingRepository.queryNewReport };
    }

    return { requiresMerge: true };
  }



  private getParametersByQuery(year: number, filter: IFindPublicacaoRelatorioNovoPayAndPending): any[] {
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