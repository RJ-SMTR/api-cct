import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from './dtos/relatorio-consolidado-novo-remessa.dto';
import { parseNumber } from '../cnab/utils/cnab/cnab-field-utils';

@Injectable()
export class RelatorioNovoRemessaRepository {
  private static readonly QUERY_CONSOLIDADO = `
      select op."userId", u."fullName", sum(op.valor) as "valorTotal"
      from ordem_pagamento op
               inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
               join lateral (
          select opah."dataReferencia",
                 opah."statusRemessa",
                 opah."motivoStatusRemessa",
                 opah."ordemPagamentoAgrupadoId",
                 opah."userBankCode",
                 opah."userBankAgency",
                 opah."userBankAccount",
                 opah."userBankAccountDigit"
          from ordem_pagamento_agrupado_historico opah
          where opa.id = opah."ordemPagamentoAgrupadoId"
            and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
          ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
               inner join "user" u on op."userId" = u.id
          and ("userId" = any($1) or $1 is null)
          and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
          and ("statusRemessa" = any($4) or $4 is null)
          and (trim(upper("nomeConsorcio")) = any($5) or $5 is null)
      group by op."userId", u."fullName"
      having (sum(op.valor) >= $6 or $6 is null)
         and (sum(op.valor) <= $7 or $7 is null)
      order by u."fullName"
  `;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    this.logger.debug(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO);

    this.getStatusParaFiltro(filter);

    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => {  return c.toUpperCase().trim();});
    }

    const parameters =
      [
        filter.userIds || null,
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.consorcioNome || null,
        filter.valorMin || null,
        filter.valorMax || null
      ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO, parameters);
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
}