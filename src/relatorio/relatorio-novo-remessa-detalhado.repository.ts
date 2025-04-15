import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioDetalhadoNovoRemessaDto, RelatorioDetalhadoNovoRemessaData } from './dtos/relatorio-detalhado-novo-remessa.dto';
import { StatusPagamento } from './enum/statusRemessaDetalhado';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorioNovoDetalhado } from './interfaces/filter-publicacao-relatorio-novo-detalhado.interface';

@Injectable()
export class RelatorioNovoRemessaDetalhadoRepository {
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
  private logger = new CustomLogger(RelatorioNovoRemessaDetalhadoRepository.name, { timestamp: true });

  public async findDetalhado(filter: IFindPublicacaoRelatorioNovoDetalhado): Promise<RelatorioDetalhadoNovoRemessaDto> {
    const year = filter.dataInicio.getFullYear();

    const { query } = this.getQueryByYear(year);

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      this.logger.log("Conectado com sucesso.");

      const parameters = this.getParametersByQuery(year, filter);


      const result: any[] = await queryRunner.query(query, parameters);
      this.logger.log(`Resultado da query: ${JSON.stringify(result)}`);

      const count = result.length;
      const valorTotal = result.reduce((acc, curr) => acc + Number.parseFloat(curr.valor), 0);

      const relatorioDetalhadoDto = new RelatorioDetalhadoNovoRemessaDto({
        count,
        valor: Number.parseFloat(valorTotal.toString()),
        data: result.map(r => new RelatorioDetalhadoNovoRemessaData({
          dataPagamento: r.dataPagamento,
          nomes: r.nomes,
          cpfCnpj: r.cpfCnpj,
          consorcio: r.nomeConsorcio,
          valor: Number.parseFloat(r.valor),
          status: r.status
        }))
      });


      this.logger.log(`Relatório detalhado: ${JSON.stringify(relatorioDetalhadoDto)} `);
      return relatorioDetalhadoDto;
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


  private getQueryByYear(year: number): { query: string; } {
    if (year <= 2024) {
      return { query: RelatorioNovoRemessaDetalhadoRepository.queryOlderReport };
    }

    return { query: RelatorioNovoRemessaDetalhadoRepository.queryNewReport };
  }

  private getParametersByQuery(year: number, filter: IFindPublicacaoRelatorioNovoDetalhado): any[] {
    const consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(nome => nome.toUpperCase().trim())
      : null;

    this.logger.log(`Nome(s) do consórcio: ${consorcioNome}`);

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