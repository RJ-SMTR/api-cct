import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoService } from "./ordem-pagamento-agrupado.service";
import { HeaderArquivoService } from "src/cnab/service/pagamento/header-arquivo.service";
import { HeaderLoteService } from "src/cnab/service/pagamento/header-lote.service";
import { DetalheAService } from "src/cnab/service/pagamento/detalhe-a.service";
import { DetalheBService } from "src/cnab/service/pagamento/detalhe-b.service";
import { OrdemPagamentoAgrupadoToHeaderArquivo } from "../convertTo/ordem-pagamento-agrupado-to-header-arquivo.convert";
import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";
import { HeaderArquivo } from "src/cnab/entity/pagamento/header-arquivo.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { SettingsService } from "src/settings/settings.service";
import { UsersService } from "src/users/users.service";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";


@Injectable()
export class RemessaService {
  private logger = new CustomLogger(RemessaService.name, { timestamp: true });

  constructor(    
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,        
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private settingsService: SettingsService, 
    private userService: UsersService
  ) {}
  
   public async prepararRemessa(dataInicio:Date,dataFim:Date,pagador: Pagador,consorcio?:string[]){
      //ler Ordens Agrupadas
      const ordens = await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio,dataFim,consorcio);
      const headerArquivo = await this.gerarHeaderArquivo(pagador);

      ordens.forEach(async opa => {
        if(opa.ordensPagamento[0].userId !=null){
            const user = await this.getuser(opa.ordensPagamento[0].userId);
            if(user.bankCode){
              const headerLote = this.gerarHeaderLote(headerArquivo,user.bankCode.toString(),opa);
              this.gerarDetalheAB(headerLote,opa);
            }
        }       
      });      
   } 
    

   private enviarRemessa(){

   }

    private async gerarHeaderArquivo(pagador: Pagador){
        const nsa = await this.settingsService.getNextNSA(false);
        const convertToHeader = OrdemPagamentoAgrupadoToHeaderArquivo.convert(pagador,nsa);
        return await this.headerArquivoService.save(convertToHeader);
    }

    private gerarHeaderLote(headerArquivo: HeaderArquivo,convenioBanco:String,ordem:OrdemPagamentoAgrupado){
        if(headerArquivo.headersLote.length > 0){
            return headerArquivo.headersLote.filter(h=>{
               h.codigoConvenioBanco === convenioBanco
            })[0];  
        }else{
           
        }        
    }

    private async getuser(userId: number){
       return await this.userService.getOne({id: userId});
    }

    private gerarDetalheAB(headerLote?: HeaderLote,ordem?:OrdemPagamentoAgrupado) {

    }
}