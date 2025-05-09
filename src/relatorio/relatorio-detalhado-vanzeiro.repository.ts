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
    let query = ` select distinct da."dataVencimento",sum(da."valorLancamento") valor,
                  case when ap."isPago"=true then 'pago'
                  else 'Não Pago' end as status ,
                  oc."message" motivo
                  from item_transacao it         
                    inner join item_transacao_agrupado ita on it."itemTransacaoAgrupadoId"=ita.id
                    inner join detalhe_a da on da."itemTransacaoAgrupadoId"=ita.id
                    inner join arquivo_publicacao ap on ap."itemTransacaoId"=it.id
                    inner join cliente_favorecido cf on cf.id=it."clienteFavorecidoId"
                    inner join ocorrencia oc on oc."detalheAId" = da."id"
                    inner join public.user pu on pu."cpfCnpj"=cf."cpfCnpj"
                  where it."nomeConsorcio" in('STPC','STPL','TEC')
                  and it."dataOrdem" between '${dataInicio}' and '${dataFim}'	
                  and pu."id"=${args.userId}
                  group by cf."nome",da."dataVencimento",oc."message"
                  order by da."dataVencimento",cf."nome" `;  
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const detalhado = result.map((r) => new RelatorioDetalhadoVanzeiroDto(r));
    return detalhado;  
  }   
} 