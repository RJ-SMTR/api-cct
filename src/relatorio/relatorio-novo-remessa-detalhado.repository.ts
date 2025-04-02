import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from './dtos/relatorio-consolidado-novo-remessa.dto';

@Injectable()
export class RelatorioNovoRemessaDetalhadoRepository {
  private static readonly queryNewReport = `
    select distinct da."dataVencimento" dataPagamento,pu."fullName" nomes,pu."cpfCnpj",
op."nomeConsorcio",da."valorLancamento" valor,
         case when oph."motivoStatusRemessa" = '00' or oph."motivoStatusRemessa" = 'BD' then 'Pago'
              when oph."motivoStatusRemessa" = '02' then 'Estorno'
         else 'Rejeitado' end as status

from ordem_pagamento op 
         inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
         inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
         inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"=oph."id"
         inner join public.user pu on pu."id" = op."userId"
where da."dataVencimento" between :dataInicio and :dataFim
and op."fullName" in(:fullName)
and op."nomeConsorcio" in(:consorcios)
and da."valorLancamento" between :valorMin and :valorMax
and status in(:status)`;

  // Add more parameters to filter
  private static readonly queryOlderReport = `
  select distinct da."dataVencimento" dataPagamento,cf."nome" nomes,cf."cpfCnpj",
ita."nomeConsorcio",da."valorLancamento" valor,
         case when da."ocorrenciasCnab" = '00' or da."ocorrenciasCnab" = 'BD' or ap."isPago"=true then 'Pago'
              when da."ocorrenciasCnab" = '02' then 'Estorno'
         else 'Rejeitado' end as status,
         ap."isPago"

from item_transacao it 
         inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId"=ita."id"
         inner join detalhe_a da on da."itemTransacaoAgrupadoId"=ita.id
         inner join cliente_favorecido cf on cf.id = it."clienteFavorecidoId"
         inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
where da."dataVencimento" between '2024-12-20' and '2024-12-30'
and it."nomeConsorcio" in('VLT');`

  private readonly queryMap = {
    2024: RelatorioNovoRemessaDetalhadoRepository.queryOlderReport,
    2025: RelatorioNovoRemessaDetalhadoRepository.queryNewReport,
  };

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }
  private logger = new CustomLogger(RelatorioNovoRemessaDetalhadoRepository.name, { timestamp: true });

  public async findDetalhado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const year = filter.dataInicio.getFullYear();
    const query = this.getQueryByYear(year);

    this.logger.debug(query);

    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => { return c.toUpperCase().trim(); });
    }

    const parameters =
      [
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.consorcioNome || null,
        filter.valorMin || null,
        filter.valorMax || null
      ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(query, parameters);
    await queryRunner.release();
    const count = result.length;
    const valorTotal = result.reduce((acc, curr) => acc + parseFloat(curr.valorTotal), 0);
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result
      .map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.fullName;
        elem.valor = parseFloat(r.valorTotal);
        return elem;
      });
    return relatorioConsolidadoDto;
  }

  private getStatusParaFiltro(filter: IFindPublicacaoRelatorioNovoRemessa) {
    let statuses: number[] | null = null;
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar) {
      statuses = [];

      if (filter.aPagar) {
        statuses.push(0);
        statuses.push(1);
      }
      if (filter.emProcessamento) {
        statuses.push(2);
      }

      if (filter.pago) {
        statuses.push(3);
      }

      if (filter.erro) {
        statuses.push(4);
      }
    }
    return statuses;
  }


  private getQueryByYear(year: number): string {
    return this.queryMap[year] || "";
  }

}