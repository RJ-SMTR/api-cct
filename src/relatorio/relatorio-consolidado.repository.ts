import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class RelatorioConsolidadoRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  private logger = new CustomLogger(RelatorioConsolidadoRepository.name, { timestamp: true });

  private getQueryAPagarConsorcio(dataInicio: string, dataFim: string, valorMin?: number, valorMax?: number, nomeConsorcio?: string[], eleicao?: boolean) {
    let query = ` select * from ( `;
    query = query + `select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor from ( `;
    query =
      query +
      ` select distinct tv.id AS id,                        
                        tv."nomeConsorcio" AS consorcio,                       
                        tv."valorPago" AS valor_agrupado
                      from transacao_view tv                     
                      where tv."itemTransacaoAgrupadoId" is null                      
                      and tv."valorPago" is not null 
                      and tv."valorPago" >0  `;

    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) query = query + ` and tv."datetimeTransacao" between '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;

    if (['Todos'].some((i) => nomeConsorcio?.includes(i))) {
      query =
        query +
        ` AND tv."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
           'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (nomeConsorcio !== undefined && !['Todos'].some((i) => nomeConsorcio?.includes(i))) query = query + ` and tv."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;
    if (eleicao !== undefined) {

      query += ` and tv."idOrdemPagamento" LIKE '%U%'`;
    } else {

      query += `and tv."idOrdemPagamento" NOT LIKE '%U%' `;
    }
    query = query + `) as cs `;

    query = query + ` group by cs."consorcio"`;

    query = query + ` order by  cs."consorcio" `;

    query = query + `) as resul where (1=1) `;

    if (valorMin !== undefined) query = query + `  and resul."valor">=${valorMin}`;

    if (valorMax !== undefined) query = query + ` and resul."valor"<=${valorMax}`;

    this.logger.debug(query);
    return query;
  }

  private getQueryConsorcio(
    dataInicio: string,
    dataFim: string,
    pago?: boolean,
    valorMin?: number,
    valorMax?: number,
    nomeConsorcio?: string[],
    emProcessamento?: boolean,
    eleicao?: boolean
  ) {
    let distinct = '';
    let cf = ''
    if(eleicao){
      if(pago){
         distinct = 'ita.id AS id';
      } else {
         distinct = ` on (cf."nome")  ita.id AS id`
        cf = ' inner join cliente_favorecido cf on it."clienteFavorecidoId" = cf.id'
      }
    } else {
       distinct = 'ita.id AS id';
    }
    let query = ` select * from ( `;
    query += ` select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor from ( `;
    query += `
    select distinct ${distinct},
                    ita."nomeConsorcio" AS consorcio,	                                     
		                da."valorLancamento" AS valor_agrupado
    from transacao_agrupado ta 
    inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId"=ta."id"
    inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
    inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
    inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id   
    ${cf}     
     
              
    where ta."statusId"<>5 `;

    if (
      dataInicio !== undefined &&
      dataFim !== undefined &&
      (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))
    ) {
      query += ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
    }

    if (nomeConsorcio !== undefined && !['Todos'].some((i) => nomeConsorcio?.includes(i))) {
      query += ` and ita."nomeConsorcio" in('${nomeConsorcio?.join("','")}')`;
    }

    if (emProcessamento) {
      query += ` and ap."isPago"=false and TRIM(da."ocorrenciasCnab")='' `;
    } else if (pago !== undefined) {
      query += ` and	ap."isPago"=${pago} and TRIM(da."ocorrenciasCnab")<>'' `;
    }
    if (eleicao !== undefined) {

      query += ` and ita."idOrdemPagamento" LIKE '%U%'`;
    } else {

      query += `and ita."idOrdemPagamento" NOT LIKE '%U%' `;
    }
    query += `) as cs `;
    query += ` group by cs."consorcio"`;
    query += ` order by cs."consorcio" `;
    query += `) as resul where (1=1) `;

    if (valorMin !== undefined) {
      query += ` and resul."valor">=${valorMin}`;
    }

    if (valorMax !== undefined) {
      query += ` and resul."valor"<=${valorMax}`;
    }



    return query;
  }


  private getQueryAPagarOperadores(dataInicio: string, dataFim: string, valorMin?: number, valorMax?: number, favorecidoNome?: string[], eleicao?: boolean) {
    let query = `select * from ( `;

    query = query + ` select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor  from ( `;

    query =
      query +
      ` select distinct tv.id AS id,
                        tv."nomeConsorcio" AS consorcio,
                        cf.nome AS favorecido,
                        cf."cpfCnpj" AS favorecido_cpfcnpj,
                        tv."valorPago" AS valor_agrupado
                        from transacao_view tv
                        inner join cliente_favorecido cf on cf."cpfCnpj"=tv."operadoraCpfCnpj"
                        where tv."itemTransacaoAgrupadoId" is null
					              and tv."valorPago" is not null 
                        and tv."valorPago" >0  `;

    query = query + `  and tv."datetimeTransacao" between '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;

    if (favorecidoNome !== undefined && !['Todos'].some((i) => favorecidoNome?.includes(i))) query = query + ` and cf.nome in('${favorecidoNome?.join("','")}')`;
    if (eleicao !== undefined) {

      query += ` and ita."idOrdemPagamento" LIKE '%U%'`;
    } else {

      query += `and ita."idOrdemPagamento" NOT LIKE '%U%' `;
    }
    query = query + ` ) as cs `;

    query = query + ` group by cs."consorcio", cs."favorecido" `;

    query = query + ` order by  cs."favorecido" `;

    query = query + `) as resul where (1=1) `;

    if (valorMin !== undefined) query = query + ` and resul."valor">=${valorMin}`;

    if (valorMax !== undefined) query = query + ` and resul."valor"<=${valorMax}`;



    this.logger.debug(query);
    return query;
  }

  private getQueryOperadores(dataInicio: string, dataFim: string, pago?: boolean, valorMin?: number, valorMax?: number, favorecidoNome?: string[], emProcessamento?: boolean, eleicao?: boolean) {
    let valor = '';
    let valor_agrupado = '';
    if(eleicao){
      if(pago){
        valor = 'da."valorRealEfetivado"'
        valor_agrupado = 'sum(cs."valor_agrupado")::float'
      } else {
        valor = ' da."valorLancamento"'
        valor_agrupado = 'cs."valor_agrupado"::float';
      }
    } else {
      valor = ' da."valorLancamento"'
      valor_agrupado = 'sum(cs."valor_agrupado")::float'
    }
    let query = ` select * from ( `;
    query = query + ` select cs."favorecido" nomeFavorecido,${valor_agrupado} as valor from ( `;
    query =
      query +
      ` select distinct ita.id AS id,
                        ita."nomeConsorcio" AS consorcio,	
                        cf.nome AS favorecido,
                        cf."cpfCnpj" AS favorecido_cpfcnpj,                        
		                    ${valor} AS valor_agrupado
                        from transacao_agrupado ta 
                        inner join item_transacao_agrupado ita on ita."transacaoAgrupadoId"=ta."id" 
                        inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                        inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                        inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                        inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"	  			
                        where ta."statusId"<>5 and ita."nomeConsorcio" in('STPC','STPL','TEC') `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) query = query + ` and da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
    if (emProcessamento == true) {
      query = query + ` and ap."isPago"=false and TRIM(da."ocorrenciasCnab")='' `;
    } else if (pago !== undefined) {
      query = query + ` and	ap."isPago"=${pago} and TRIM(da."ocorrenciasCnab")<>'' `;
    }

    if (favorecidoNome !== undefined && !['Todos'].some((i) => favorecidoNome?.includes(i))) query = query + ` and cf.nome in('${favorecidoNome?.join("','")}')`;

    if (eleicao !== undefined) {

      query += ` and ita."idOrdemPagamento" LIKE '%U%'`;
    } else {

      query += `and ita."idOrdemPagamento" NOT LIKE '%U%' `;
    }
    query = query + `) as cs `;

    query = query + `${eleicao && !pago ? 'group by cs."consorcio", cs."favorecido", cs."valor_agrupado"' : ' group by cs."consorcio", cs."favorecido"'}`;

    query = query + ` order by  cs."favorecido" `;

    query = query + `) as resul where (1=1) `;


    if (valorMin !== undefined) {
     
        query = query + `  and resul."valor" >=${valorMin}`;
    }

    if (valorMax !== undefined) {
    
        query = query + ` and resul."valor" <= ${valorMax}`;
    }
    return query;
  }
// ELEICAO COM FILTRO DE ERRO TIRA A SOMA 
  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {

    let queryConsorcio = '';
    let queryOperadores = '';
    if (!args.favorecidoNome && !args.consorcioNome) {

      queryOperadores = this.getQueryOperadores(
        args.dataInicio.toISOString().slice(0, 10),
        args.dataFim.toISOString().slice(0, 10),
        args.pago,
        args.valorMin,
        args.valorMax,
        args.favorecidoNome,
        args.emProcessamento,
        args.eleicao
      );
    } else {
      if (args.aPagar === true && args.favorecidoNome === undefined) {
        queryConsorcio = this.getQueryAPagarConsorcio(args.dataInicio.toISOString().slice(0, 10), args.dataFim.toISOString().slice(0, 10), args.valorMin, args.valorMax, args.consorcioNome, args.eleicao);
      }

      if ((args.aPagar === undefined || args.aPagar === false) && (args.consorcioNome !== undefined || args.favorecidoNome === undefined)) {

        queryConsorcio = this.getQueryConsorcio(args.dataInicio.toISOString().slice(0, 10), args.dataFim.toISOString().slice(0, 10), args.pago, args.valorMin, args.valorMax, args.consorcioNome, args.emProcessamento, args.eleicao);
      }

      if (args.aPagar === true && args.consorcioNome === undefined) {
        queryOperadores = this.getQueryAPagarOperadores(args.dataInicio.toISOString().slice(0, 10), args.dataFim.toISOString().slice(0, 10), args.valorMin, args.valorMax, args.favorecidoNome, args.eleicao);
      }

      if ((args.aPagar === undefined || args.aPagar === false) && (args.consorcioNome === undefined || args.favorecidoNome !== undefined)) {
        queryOperadores = this.getQueryOperadores(args.dataInicio.toISOString().slice(0, 10), args.dataFim.toISOString().slice(0, 10), args.pago, args.valorMin, args.valorMax, args.favorecidoNome, args.emProcessamento, args.eleicao);
      }

      if (queryConsorcio !== '' && queryOperadores !== '') {
        queryOperadores = ` union all ` + queryOperadores;
      }
    }


    const query = queryConsorcio + queryOperadores;
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }
}
