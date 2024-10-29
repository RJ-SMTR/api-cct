import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { RelatorioSinteticoDto } from './dtos/relatorio-sintetico.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';

@Injectable()
export class RelatorioSinteticoRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private logger = new CustomLogger(RelatorioSinteticoRepository.name, { timestamp: true });

  private getQuery(args: IFindPublicacaoRelatorio) {
    if (args.aPagar === true) {
      return this.getQueryApagar(args);
    } else if (args.aPagar === false || args.aPagar === undefined) {
      return this.getQueryNaoApagar(args);
    } else {
      return this.getQueryApagar(args) + ` union all ` + this.getQueryNaoApagar(args);
    }
  }

  public async findSintetico(args: IFindPublicacaoRelatorio): Promise<RelatorioSinteticoDto[]> {
    const query = this.getQuery(args);
    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const sinteticos = result.map((r) => new RelatorioSinteticoDto(r));
    return sinteticos;
  }

  public getQueryApagar(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10);
    const dataFim = args.dataFim.toISOString().slice(0, 10);
    let query = `WITH subtotal_data AS ( `;
    query = query + `    SELECT  `;
    query = query + `    tv."nomeConsorcio", `;
    query = query + `    SUM(tv."valorPago") AS subTotal `;
    query = query + `    FROM transacao_view tv `;
    query = query + `    WHERE tv."valorPago" > 0 `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) {
      query = query + `  AND tv."datetimeTransacao" BETWEEN '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;
    }
    query = query + `    AND tv."itemTransacaoAgrupadoId" IS NULL `;
    query = query + `    GROUP BY tv."nomeConsorcio" ), `;
    query = query + `total_data AS ( `;
    query = query + `     SELECT  `;
    query = query + `     SUM(tv."valorPago") AS Total `;
    query = query + `     FROM transacao_view tv `;
    query = query + `     WHERE tv."valorPago" > 0 `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) {
      query = query + ` AND tv."datetimeTransacao" BETWEEN '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;
    }

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      query = query + ` AND tv."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      query =
        query +
        ` AND tv."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
           'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      query = query + ` AND tv."nomeConsorcio" in('STPC','STPL') `;
    }
    query = query + ` AND tv."itemTransacaoAgrupadoId" IS NULL) `;

    query = query + `  SELECT DISTINCT `;
    query = query + `  res.*, `;
    query = query + `  COALESCE(sub.subTotal, 0) AS subTotal,`;
    query = query + `  total_data.Total`;
    query = query + `  FROM (`;

    let body = ` SELECT DISTINCT
        tv.id,
        (tv."datetimeTransacao":: DATE)::VARCHAR AS datatransacao,
        CASE
        WHEN tv."nomeConsorcio" = 'VLT' THEN (tv."datetimeTransacao":: DATE + INTERVAL '2 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 0 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '3 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 1 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '2 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 2 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '8 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 3 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '7 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 4 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '6 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 5 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '5 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 6 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '4 day')::VARCHAR
        END AS datapagamento,
        tv."nomeConsorcio" AS consorcio,
        COALESCE(cf.nome,uu."fullName") AS favorecido,
        tv."operadoraCpfCnpj" cpfCnpj,
        ROUND(tv."valorPago", 2)::FLOAT AS valor,
        'a pagar' AS status,
        '' AS mensagem_status `;

    body = body + `FROM transacao_view tv `;
    body = body + `LEFT JOIN cliente_favorecido cf ON tv."operadoraCpfCnpj" = cf."cpfCnpj" `;
    body = body + `LEFT JOIN public.user uu on uu."cpfCnpj"=tv."operadoraCpfCnpj" `;
    let conditions = `where tv."valorPago" >0 and`;

    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) conditions = conditions + ` tv."datetimeTransacao" between '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      conditions = conditions + ` and tv."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if (args.favorecidoNome !== undefined && !['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      conditions = conditions + ` and cf."nome" in('${args.favorecidoNome?.join("','")}')`;
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      conditions =
        conditions +
        ` and tv."nomeConsorcio" 
          in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i)) && args.consorcioNome !== undefined) {
      conditions = conditions + ` and tv."nomeConsorcio" in('STPC','STPL',${args.consorcioNome?.join("','")}) `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      conditions = conditions + ` and tv."nomeConsorcio" in('STPC','STPL') `;
    }

    let footer = `) AS res
        LEFT JOIN subtotal_data sub 
          ON res."consorcio" = sub."nomeConsorcio"          
        CROSS JOIN total_data
        ORDER BY res."consorcio", res."favorecido", res."datapagamento"`;

    let result = ` select * from ( ` + query + body + conditions + footer + ` ) as tt  where (1=1)`;
    return result;
  }

  public getQueryNaoApagar(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10);
    const dataFim = args.dataFim.toISOString().slice(0, 10);
    let query = ` select distinct res.*, `;
    query = query + `(select sum(ss."valorLancamento")::float  from `;
    query =
      query +
      `  (select distinct dta.id,dta."valorLancamento"                    
                          from detalhe_a dta 
                          inner join item_transacao_agrupado tt on dta."itemTransacaoAgrupadoId"=tt.id
                          inner join transacao_agrupado tta on tta."id"=tt."transacaoAgrupadoId" and tta."statusId"<>'5'
                          left join item_transacao itt on itt."itemTransacaoAgrupadoId" = tt."id"
                          left join arquivo_publicacao app on app."itemTransacaoId"=itt.id
                          WHERE `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) query = query + ` dta."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
    if (args.emProcessamento !== undefined && args.emProcessamento === true) {
      query = query + ` and app."isPago"=false and TRIM(dta."ocorrenciasCnab")='' `;
    } else if (args.pago !== undefined) {
      query = query + ` and app."isPago"=${args.pago} and TRIM(dta."ocorrenciasCnab")<>'' `;
    }
    query = query + ` and tt."nomeConsorcio"=res.consorcio `;
    query = query + ` )as ss)  as subTotal, `;

    query =
      query +
      `(select sum(tt."valorLancamento")::float from
                      (select distinct dta.id,dta."valorLancamento"            
                      from detalhe_a dta 
                      inner join item_transacao_agrupado tt on dta."itemTransacaoAgrupadoId"=tt.id
                      inner join transacao_agrupado tta on tta."id"=tt."transacaoAgrupadoId" and tta."statusId"<>'5'
                      left join item_transacao itt on itt."itemTransacaoAgrupadoId" = tt."id"
                      left join arquivo_publicacao app on app."itemTransacaoId"=itt.id
                      WHERE `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) query = query + `  dta."dataVencimento" between '${dataInicio}' and '${dataFim}'`;
    if (args.emProcessamento !== undefined && args.emProcessamento === true) {
      query = query + ` and app."isPago"=false and TRIM(dta."ocorrenciasCnab")='' `;
    } else if (args.pago !== undefined) {
      query = query + ` and app."isPago"=${args.pago} and TRIM(dta."ocorrenciasCnab")<>'' `;
    }

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      query = query + ` and tt."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if (args.favorecidoNome !== undefined && !['Todos'].some((i) => args.favorecidoNome?.includes(i))) query = query + ` and tt."nomeConsorcio" in(res.consorcio) `;
    else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      query =
        query +
        ` and tt."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
                         'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      query = query + ` and tt."nomeConsorcio" in('STPC','STPL','TEC') `;
    }
    query = query + ` )as tt  )as total `;

    query = query + `from ( `;

    query =
      query +
      `               
    select distinct
      it.id, 
      case
      when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=1 THEN --segunda
      (da."dataVencimento":: Date - INTERVAL '4 day')::varchar 
      when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=2 THEN --terça
      (da."dataVencimento":: Date -  INTERVAL '4 day')::varchar 
      when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=3 THEN --quarta
      (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
      when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=4 THEN --quinta
      (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 
      when (it."nomeConsorcio" = 'VLT') and EXTRACT( DOW FROM da."dataVencimento")=5 THEN --Sexta
      (da."dataVencimento":: Date - INTERVAL '2 day')::varchar 		
      end as datatransacao, 	
      da."dataVencimento"::date::Varchar As datapagamento,
      it."nomeConsorcio" AS consorcio,	
      cf.nome AS favorecido,
      cf."cpfCnpj",	
      it."valor"::float as valor,			      
      case 
      when(not(ap."isPago") and TRIM(da."ocorrenciasCnab")='')then 'Aguardando Pagamento'	
      when (ap."isPago") then 'pago' 
        when (not (ap."isPago")) then 'naopago'
        else 'apagar' end AS status,
      case when (not (ap."isPago")) then oc."message" 
      else '' end As mensagem_status `;

    query =
      query +
      ` from item_transacao_agrupado ita
      inner join detalhe_a da on da."itemTransacaoAgrupadoId"= ita.id
      inner join item_transacao it on ita.id = it."itemTransacaoAgrupadoId"
      inner join transacao_agrupado ta on ta."id"=ita."transacaoAgrupadoId" and ta."statusId"<>'5'
      inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
      inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
      left join ocorrencia oc on oc."detalheAId"=da.id              
      where  `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) query = query + ` da."dataVencimento" between '${dataInicio}' and '${dataFim}'`;

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      query = query + ` and it."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if (args.favorecidoNome !== undefined && !['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      query = query + ` and cf."nome" in('${args.favorecidoNome?.join("','")}')`;
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      query =
        query +
        ` and it."nomeConsorcio" 
      in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      query = query + ` and it."nomeConsorcio" in('STPC','STPL','TEC') `;
    }

    if (args.emProcessamento !== undefined && args.emProcessamento === true) {
      query = query + `  and ap."isPago"=false and TRIM(da."ocorrenciasCnab")='' `;
    } else if (args.pago !== undefined) {
      query = query + ` and	ap."isPago"=${args.pago} and TRIM(da."ocorrenciasCnab")<>'' `;
    }

    if (args.valorMin !== undefined) query = query + `  and it."valor">=${args.valorMin}`;

    if (args.valorMax !== undefined) query = query + ` and it."valor"<=${args.valorMax}`;

    query =
      query +
      ` ) as res
            order by  "consorcio", "favorecido","datapagamento" `;

    this.logger.debug(query);

    return query;
  }
}
