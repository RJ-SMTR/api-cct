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

@Injectable()
export class OrdemPagamentoService {

   private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

   constructor( private ordemPamentoRepository: OrdemPagamentoRepository,
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private pagadorService: PagadorService,     
    private usersService: UsersService       
   ){}
    
   async preprararPagamento(dataOrdemInicialDate,dataOrdemFinalDate,pagadorKey: keyof AllPagadorDict){

       const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemInicialDate, dataOrdemFinalDate, 0);

       const contaPagadora = this.getPagador(pagadorKey);

       ordens.forEach(async ordem=>{

            if(ordem.operadoraCpfCnpj){
                const user = await this.getFavorecido(ordem.operadoraCpfCnpj);
                if(user){
                    const ordemPagamentoDto =  await this.inserirOrdemPagamento(ordem,contaPagadora,user.id);
                    const ordemPagamentoAgrupada = await this.inserirOrdemPagamentoAgrupada(ordem,ordemPagamentoDto);
                }
            }
       });   
    }
   
    async getPagador(pagadorKey: any) {
       return (await this.pagadorService.getAllPagador())[pagadorKey];
    }

    async getFavorecido(operadoraCpfCnpj: string): Promise<Nullable<User>>{
        return await this.usersService.findOne({ cpfCnpj: operadoraCpfCnpj })
    }


    async inserirOrdemPagamento(ordem: BigqueryOrdemPagamentoDTO,contaPagadora,userId:number){
        const ordemPagamento = await this.convertOrdemDto(ordem,contaPagadora,userId);
        await this.ordemPamentoRepository.save(ordemPagamento);        
    }
  

    async inserirOrdemPagamentoAgrupada(ordem: BigqueryOrdemPagamentoDTO,ordemPagamentoDto) {
        throw new Error("Method not implemented.");
    }

    convertOrdemDto(ordem: BigqueryOrdemPagamentoDTO, contaPagadora: any, userId: any): Promise<OrdemPagamentoEntity>  {
        throw new Error("Method not implemented.");
    }
}