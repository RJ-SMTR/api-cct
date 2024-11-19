import { Injectable } from "@nestjs/common";
import { BigqueryOrdemPagamentoDTO } from "src/bigquery/dtos/bigquery-ordem-pagamento.dto";
import { BigqueryOrdemPagamentoService } from "src/bigquery/services/bigquery-ordem-pagamento.service";
import { AllPagadorDict } from "src/cnab/interfaces/pagamento/all-pagador-dict.interface";
import { PagadorService } from "src/cnab/service/pagamento/pagador.service";
import { UsersService } from "src/users/users.service";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoRepository } from "../repository/ordem-pagamento.repository";
import { OrdemPagamentoAgrupadoRepository } from "../repository/ordem-pagamento-agrupado.repository";
import { OrdemPagamentoEntity } from "../entity/ordens-pagamento.entity";
import { User } from "src/users/entities/user.entity";
import { Nullable } from "src/utils/types/nullable.type";
import { Between } from "typeorm";
import { OrdemPagamentoAgrupadoEntity } from "../entity/ordens-pagamentos-agrupadas.entity";

@Injectable()
export class OrdemPagamentoService {

   private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

   constructor( private ordemPamentoRepository: OrdemPagamentoRepository,
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private pagadorService: PagadorService,     
    private usersService: UsersService       
   ){}

   async sincronizarOrdensPagamento(dataOrdemInicialDate:Date,dataOrdemFinalDate:Date){
        const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemInicialDate, dataOrdemFinalDate, 0);

        ordens.forEach(async ordem=>{

            if(ordem.operadoraCpfCnpj){
                const user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });

                if(user){ 
                    await this.inserirOrdemPagamento(ordem,user.id);
                }
            }

        });
   }
    
   async preprararPagamentos(dataOrdemInicial:Date,dataOrdemFinal:Date,pagadorKey: keyof AllPagadorDict){

       const ordens = await this.ordemPamentoRepository.findAll({dataOrdem: Between(dataOrdemInicial,dataOrdemFinal)});       

       const contaPagadora = await this.getPagador(pagadorKey);
      
       const ordemPagamentoAgrupada = await this.inserirOrdemPagamentoAgrupada(ordens); 
    }
   
    async getPagador(pagadorKey: any) {
       return (await this.pagadorService.getAllPagador())[pagadorKey];
    }

    async getFavorecido(operadoraCpfCnpj: string): Promise<Nullable<User>>{
        return await this.usersService.findOne({ cpfCnpj: operadoraCpfCnpj })
    }

    async inserirOrdemPagamento(ordem: BigqueryOrdemPagamentoDTO,userId:number){
        const ordemPagamento = await this.convertOrdemPagamento(ordem,userId);
        await this.ordemPamentoRepository.save(ordemPagamento);        
    }
  

    async inserirOrdemPagamentoAgrupada(ordens: OrdemPagamentoEntity[]) {
        for (const ordem of ordens) {
          let ordemPagamentoAgrupado = await this.ordemPamentoAgrupadoRepository.findOne({ordensPagamento: [{ id: ordem.id }]})
          if(!ordemPagamentoAgrupado){
            ordemPagamentoAgrupado = new OrdemPagamentoAgrupadoEntity();  
          }                 

          ordemPagamentoAgrupado.ValorTotal = ordem.valor;

          await this.ordemPamentoAgrupadoRepository.save(ordemPagamentoAgrupado);
        }
    }

    convertOrdemPagamento(ordem: BigqueryOrdemPagamentoDTO, userId: any): OrdemPagamentoEntity {
        var result = new OrdemPagamentoEntity();
        result.createdAt = new Date();
        result.dataOrdem = ordem.dataOrdem;
        result.idConsorcio = ordem.idConsorcio;
        result.idOperadora = ordem.idOperadora;
        result.idOrdemPagamento  = ordem.idOrdemPagamento;
        result.nomeConsorcio = ordem.consorcio;
        result.nomeOperadora = ordem.operadora;
        result.userId = userId;
        result.valor = ordem.valorTotalTransacaoLiquido;
        return result ;
    }

}