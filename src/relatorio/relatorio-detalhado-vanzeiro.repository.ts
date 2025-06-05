import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioDetalhadoVanzeiroDto } from './dtos/relatorio-detalhado-vanzeiro.dto';

@Injectable()
export class RelatorioDetalhadoRepository { 
  
  constructor(@InjectDataSource()
              private readonly dataSource: DataSource) {}

              private logger = new CustomLogger(RelatorioDetalhadoRepository.name, { timestamp: true }); 
              
  async findDetalhadoVanzeiro(args: { userId: number;dataInicio: Date; dataFim: Date; }) {
    const dataInicio = args.dataInicio.toISOString().slice(0,10)
    const dataFim = args.dataFim.toISOString().slice(0,10)
    let query = ` select data."dataVencimento", sum(data."valorLancamento") as valor, data.status, data.motivo
from (
        select distinct
            da.id, da."dataVencimento", da."valorLancamento",
case
    when ap."isPago" = true then 'Pago'
    else 'Não Pago'
end as status,
oc."message" motivo
        from
            item_transacao it
            inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId" = ita.id
            inner join detalhe_a da on da."itemTransacaoAgrupadoId" = ita.id
            inner join arquivo_publicacao ap on ap."itemTransacaoId" = it.id
            inner join cliente_favorecido cf on cf.id = it."clienteFavorecidoId"
            inner join ocorrencia oc on oc."detalheAId" = da."id"
            inner join public.user pu on pu."cpfCnpj" = cf."cpfCnpj"
            inner join header_lote hl on hl.id = da."headerLoteId"
            inner join header_arquivo ha on ha.id = hl."headerArquivoId"
        where
                  it."nomeConsorcio" in('STPC','STPL','TEC')
                  and da."dataVencimento" between '${dataInicio}' and '${dataFim}'	
                     AND ita."idOrdemPagamento"  NOT LIKE '%U%'
                   and ha.status <> '5'
                  and pu."id"=${args.userId}
      ) as data
group by
    data."dataVencimento",
    data.status,
    data.motivo
order by data."dataVencimento"
                  `;  
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    this.logger.warn(query)
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const detalhado = result.map((r) => new RelatorioDetalhadoVanzeiroDto(r));
    return detalhado;  
  }   
} 