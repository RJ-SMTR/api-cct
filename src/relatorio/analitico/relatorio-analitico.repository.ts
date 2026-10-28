import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioAnaliticoDto } from '../dtos/relatorio-analitico.dto';
import { IFindPublicacaoRelatorio } from '../interfaces/find-publicacao-relatorio.interface';


@Injectable()
export class RelatorioAnaliticoRepository { 
  
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

              private logger = new CustomLogger(RelatorioAnaliticoRepository.name, { timestamp: true });
  
  private getQueryAPagarConsorcio(dataInicio:string,dataFim:string,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[],paramOffset = 0){
    const params: unknown[] = [];
    const next = () => `$${paramOffset + params.length}`;

     let query = `
        select * from (
          select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor
             from ( select distinct ita.id AS id,
              ita."nomeConsorcio" AS consorcio,
              cf.nome AS favorecido,
              cf."cpfCnpj" AS favorecido_cpfcnpj,
              ita."valor" AS valor_agrupado
              from item_transacao_agrupado ita
              inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
              inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
              inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              WHERE (1=1)  `;

              if(dataInicio!==undefined && dataFim!==undefined &&
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) {
                params.push(dataInicio); const p1 = next();
                params.push(dataFim); const p2 = next();
                query = query + ` and ita."dataOrdem" between ${p1} and ${p2}`;
              }

              if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i)))) {
                params.push(nomeConsorcio);
                query = query +` and ita."nomeConsorcio" = ANY(${next()}::text[])`;
              }

              query = query +`  and (ap."isPago"=false  or  ap."isPago" is null) `;

              query = query +  `) as cs `;

              query = query + ` group by cs."consorcio"`

              query = query + ` order by  cs."consorcio" `;

              query = query +  `) as resul where (1=1) `;

              if(valorMin!==undefined) {
                params.push(valorMin);
                query = query +`  and resul."valor">=${next()}`;
              }

              if(valorMax!==undefined) {
                  params.push(valorMax);
                  query = query + ` and resul."valor"<=${next()}`;
              }

            query = query + " union All ";

            query = query +`
            select * from ( select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor
             from (
              select distinct ita.id AS id,
                ita."nomeConsorcio" AS consorcio,
                cf.nome AS favorecido,
                cf."cpfCnpj" AS favorecido_cpfcnpj,
                da."valorLancamento" AS valor_agrupado
                from item_transacao_agrupado ita
                inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              WHERE (1=1) `;

              if(dataInicio!==undefined && dataFim!==undefined &&
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) {
                params.push(dataInicio); const p1 = next();
                params.push(dataFim); const p2 = next();
                query = query + ` and da."dataVencimento" between ${p1} and ${p2}`;
              }

              if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i)))) {
                params.push(nomeConsorcio);
                query = query +` and ita."nomeConsorcio" = ANY(${next()}::text[])`;
              }

                query = query + ` and	ap."isPago"=false `;

                query = query + ` and da."ocorrenciasCnab" is null `;

                query = query +  `) as cs `;

                query = query + ` group by cs."consorcio"`

                query = query + ` order by  cs."consorcio" `;

                query = query +  `) as resul where (1=1) `;

                if(valorMin!==undefined) {
                  params.push(valorMin);
                  query = query +`  and resul."valor">=${next()}`;
                }

                if(valorMax!==undefined) {
                    params.push(valorMax);
                    query = query + ` and resul."valor"<=${next()}`;
                }

            this.logger.debug(query);
    return { query, params };
  }
  
  private getQueryConsorcio(dataInicio:string,dataFim:string,pago?:boolean,
    valorMin?:number,valorMax?:number,nomeConsorcio?:string[],paramOffset = 0){
    const params: unknown[] = [];
    const next = () => `$${paramOffset + params.length}`;

    let query = `
        select * from ( select cs."consorcio" nomeFavorecido,sum(cs."valor_agrupado")::float valor
             from (
              select distinct ita.id AS id,
                ita."nomeConsorcio" AS consorcio,
                cf.nome AS favorecido,
                cf."cpfCnpj" AS favorecido_cpfcnpj,
                da."valorLancamento" AS valor_agrupado
                from item_transacao_agrupado ita
                inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
              WHERE (1=1) `;

              if(dataInicio!==undefined && dataFim!==undefined &&
                (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))) {
                params.push(dataInicio); const p1 = next();
                params.push(dataFim); const p2 = next();
                query = query + ` and da."dataVencimento" between ${p1} and ${p2}`;
              }

              if((nomeConsorcio!==undefined) && !(['Todos'].some(i=>nomeConsorcio?.includes(i)))) {
                params.push(nomeConsorcio);
                query = query +` and ita."nomeConsorcio" = ANY(${next()}::text[])`;
              }

              if(pago!==undefined) {
                params.push(pago);
                query = query + ` and	ap."isPago"=${next()}`;
              }

              if(pago ===false)
                query = query + ` and da."ocorrenciasCnab" is not null
                and  da."ocorrenciasCnab" not in('00','BD') `;

            query = query +  `) as cs `;

            query = query + ` group by cs."consorcio"`

            query = query + ` order by  cs."consorcio" `;

            query = query +  `) as resul where (1=1) `;

            if(valorMin!==undefined) {
              params.push(valorMin);
              query = query +`  and resul."valor">=${next()}`;
            }

            if(valorMax!==undefined) {
                params.push(valorMax);
                query = query + ` and resul."valor"<=${next()}`;
            }

    return { query, params };
  }
 
  private getQueryAPagarOperadores(dataInicio:string,dataFim:string,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[],paramOffset = 0){
    const params: unknown[] = [];
    const next = () => `$${paramOffset + params.length}`;

    let query = `
        select * from (select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor
                 from (
                  select distinct ita.id AS id,
                  ita."nomeConsorcio" AS consorcio,
                  cf.nome AS favorecido,
                  cf."cpfCnpj" AS favorecido_cpfcnpj,
                  ita."valor" AS valor_agrupado
                  from item_transacao_agrupado ita
                  inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                  inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                  inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                  WHERE ita."nomeConsorcio" in('STPC','STPL') `;
                  if(dataInicio!==undefined && dataFim!==undefined &&
                    (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) {
                    params.push(dataInicio); const p1 = next();
                    params.push(dataFim); const p2 = next();
                    query = query + ` and ita."dataOrdem" between ${p1} and ${p2}`;
                  }

                    query = query +` and	(ap."isPago"=false  or ap."isPago" is null)  `;

                  if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i)))) {
                    params.push(favorecidoNome);
                    query = query +` and cf.nome = ANY(${next()}::text[])`;
                  }

                  query = query +`) as cs `;

                  query = query + ` group by cs."consorcio", cs."favorecido" `

                  query = query + ` order by  cs."favorecido" `;

                  query = query +  `) as resul where (1=1) `;

                  if(valorMin!==undefined) {
                    params.push(valorMin);
                    query = query +`  and resul."valor">=${next()}`;
                  }

                  if(valorMax!==undefined) {
                      params.push(valorMax);
                      query = query + ` and resul."valor"<=${next()}`;
                  }

            query = query + ` union all `;

            query = query + ` select * from (select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor
                 from (
                  select distinct ita.id AS id,
                  ita."nomeConsorcio" AS consorcio,
                  cf.nome AS favorecido,
                  cf."cpfCnpj" AS favorecido_cpfcnpj,
                  da."valorLancamento" AS valor_agrupado
                  from transacao_view tv
                  inner join item_transacao_agrupado ita on tv."itemTransacaoAgrupadoId"=ita.id
                  inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                  inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                  inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                  inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                  WHERE ita."nomeConsorcio" in('STPC','STPL') `;
                  if(dataInicio!==undefined && dataFim!==undefined &&
                    (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) {
                    params.push(dataInicio); const p1 = next();
                    params.push(dataFim); const p2 = next();
                    query = query +` and da."dataVencimento" between ${p1} and ${p2}`;
                  }

                  query = query + ` and	ap."isPago"=false `;

                  query = query + ` and da."ocorrenciasCnab" is null `;

                  if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i)))) {
                    params.push(favorecidoNome);
                    query = query +` and cf.nome = ANY(${next()}::text[])`;
                  }

                  query = query +`) as cs `;

                  query = query + ` group by cs."consorcio", cs."favorecido" `;

                  query = query + ` order by cs."favorecido" `;

                  query = query +  `) as resul where (1=1) `;

                  if(valorMin!==undefined) {
                    params.push(valorMin);
                    query = query +`  and resul."valor">=${next()}`;
                  }

                  if(valorMax!==undefined) {
                      params.push(valorMax);
                      query = query + ` and resul."valor"<=${next()}`;
                  }

            query = query + ` union all `;

            query = query + `select * from ( select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor
                 from (
                  select distinct tv.id AS id,
                  tv."nomeConsorcio" AS consorcio,
                  cf.nome AS favorecido,
                  cf."cpfCnpj" AS favorecido_cpfcnpj,
                  tv."valorTransacao" AS valor_agrupado
                  from transacao_view tv
                  inner join cliente_favorecido cf on cf."cpfCnpj" =tv."operadoraCpfCnpj"
                  WHERE tv."nomeConsorcio" in('STPC','STPL')  `;

                  params.push(dataInicio+' 00:00:00'); const p3 = next();
                  params.push(dataFim+' 23:59:59'); const p4 = next();
                  query = query +`  and tv."datetimeTransacao" between ${p3} and ${p4} `;

                  if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i)))) {
                    params.push(favorecidoNome);
                    query = query +` and cf.nome = ANY(${next()}::text[])`;
                  }

                  query = query + ` ) as cs `;

                  query = query + ` group by cs."consorcio", cs."favorecido" `;

                  query = query + ` order by  cs."favorecido" `;

                  query = query +  `) as resul where (1=1) `;

                  if(valorMin!==undefined) {
                    params.push(valorMin);
                    query = query +`  and resul."valor">=${next()}`;
                  }

                  if(valorMax!==undefined) {
                      params.push(valorMax);
                      query = query + ` and resul."valor"<=${next()}`;
                  }

            this.logger.debug(query);
    return { query, params };
  }
  
  private getQueryOperadores(dataInicio:string,dataFim:string,pago?:boolean,valorMin?:number,
    valorMax?:number,favorecidoNome?:string[],paramOffset = 0){
      const params: unknown[] = [];
      const next = () => `$${paramOffset + params.length}`;

      let query =
            ` select * from (
              select cs."favorecido" nomeFavorecido,sum(cs."valor_agrupado")::float  valor
                 from (
                  select distinct ita.id AS id,
                  ita."nomeConsorcio" AS consorcio,
                  cf.nome AS favorecido,
                  cf."cpfCnpj" AS favorecido_cpfcnpj,
                  da."valorLancamento" AS valor_agrupado
                  from transacao_view tv
                  inner join item_transacao_agrupado ita on tv."itemTransacaoAgrupadoId"=ita.id
                  inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
                  inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
                  inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                  inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                  WHERE ita."nomeConsorcio" in('STPC','STPL') `;
                  if(dataInicio!==undefined && dataFim!==undefined &&
                    (dataFim === dataInicio ||  new Date(dataFim)>new Date(dataInicio))) {
                    params.push(dataInicio); const p1 = next();
                    params.push(dataFim); const p2 = next();
                    query = query +` and da."dataVencimento" between ${p1} and ${p2}`;
                  }

                  if(pago!==undefined) {
                    params.push(pago);
                    query = query + ` and	ap."isPago"=${next()}`;
                  }

                  if(pago ===false)
                    query = query + ` and da."ocorrenciasCnab" is not null
                    and  da."ocorrenciasCnab" not in('00','BD') `;

                  if(favorecidoNome!==undefined && !(['Todos'].some(i=>favorecidoNome?.includes(i)))) {
                    params.push(favorecidoNome);
                    query = query +` and cf.nome = ANY(${next()}::text[])`;
                  }

                  query = query +  `) as cs `;

                  query = query + ` group by cs."consorcio", cs."favorecido" `;

                  query = query + ` order by  cs."favorecido" `;

                  query = query +  `) as resul where (1=1) `;

                  if(valorMin!==undefined) {
                    params.push(valorMin);
                    query = query +`  and resul."valor">=${next()}`;
                  }

                  if(valorMax!==undefined) {
                      params.push(valorMax);
                      query = query + ` and resul."valor"<=${next()}`;
                  }

    return { query, params };
  }

  public async findAnalitico(args: IFindPublicacaoRelatorio): Promise<RelatorioAnaliticoDto[]> {
    let queryConsorcio = '';
    let paramsConsorcio: unknown[] = [];
    if(args.aPagar === true && args.favorecidoNome ===undefined){
      const r = this.getQueryAPagarConsorcio(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.valorMin,
        args.valorMax,args.consorcioNome,0);
      queryConsorcio = r.query;
      paramsConsorcio = r.params;
    }

    if((args.aPagar === undefined || args.aPagar === false) &&
    (args.consorcioNome!==undefined || args.favorecidoNome === undefined)){
      const r = this.getQueryConsorcio(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.pago,args.valorMin,
        args.valorMax,args.consorcioNome,0);
      queryConsorcio = r.query;
      paramsConsorcio = r.params;
    }

    let queryOperadores ='';
    let paramsOperadores: unknown[] = [];
    if(args.aPagar === true && args.consorcioNome===undefined){
      const r = this.getQueryAPagarOperadores(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.valorMin,
        args.valorMax,args.favorecidoNome,paramsConsorcio.length);
      queryOperadores = r.query;
      paramsOperadores = r.params;
    }

    if((args.aPagar === undefined || args.aPagar === false) && (args.consorcioNome===undefined || args.favorecidoNome !==undefined)) {
      const r = this.getQueryOperadores(args.dataInicio.toISOString().slice(0,10),
      args.dataFim.toISOString().slice(0,10),args.pago,args.valorMin,args.valorMax,args.favorecidoNome,paramsConsorcio.length);
      queryOperadores = r.query;
      paramsOperadores = r.params;
    }

    if(queryConsorcio !=='' && queryOperadores!==''){
      queryOperadores = ` union all `+queryOperadores;
    }

    const query = queryConsorcio + queryOperadores;
    const params = [...paramsConsorcio, ...paramsOperadores];
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(query, params);
    queryRunner.release();
    const analiticos = result.map((r) => new RelatorioAnaliticoDto(r));
    return analiticos;
  }
}