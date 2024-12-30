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
import { HeaderLoteDTO } from "src/cnab/dto/pagamento/header-lote.dto";
import { Cnab104FormaLancamento } from "src/cnab/enums/104/cnab-104-forma-lancamento.enum";
import { DetalheADTO } from "src/cnab/dto/pagamento/detalhe-a.dto";
import { HeaderLoteToDetalheA } from "../convertTo/header-lote-to-detalhe-a.convert";
import { DetalheAToDetalheB } from "../convertTo/detalhe-a-to-detalhe-b.convert";


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
    const ordens = await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio,dataFim,consorcio);
    const headerArquivo = await this.gerarHeaderArquivo(pagador);
    let nsr = 1;
    let nsrAux =0;
    ordens.forEach(async opa => {      
      if(opa.ordensPagamento[0].userId !=null){
        const user = await this.getuser(opa.ordensPagamento[0].userId);
        if(user.bankCode){
          const headerLote = await this.gerarHeaderLote(headerArquivo,user.bankCode.toString(),opa);
          if(headerLote){
            nsrAux = await this.gerarDetalheAB(headerLote,opa,nsr);            
          }
        }
        nsr = nsrAux++;
      }       
    });      
  }     

  private async gerarHeaderArquivo(pagador: Pagador){
    const nsa = await this.settingsService.getNextNSA(false);
    const convertToHeader = OrdemPagamentoAgrupadoToHeaderArquivo.convert(pagador,nsa);
    return await this.headerArquivoService.save(convertToHeader);
  }

  private async gerarHeaderLote(headerArquivo: HeaderArquivo,convenioBanco:String,
    ordem:OrdemPagamentoAgrupado){     
    //verifica se existe header lote para o convenio para esse header arquivo  
    var headerLote = headerArquivo.headersLote.filter(h=>{
      h.codigoConvenioBanco === convenioBanco
    })[0];  

    if(!headerLote){ //Se não existe cria
      var headerLoteNew = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivo, ordem.pagador,
        convenioBanco ==='104'?Cnab104FormaLancamento.CreditoContaCorrente:Cnab104FormaLancamento.TED);
      await this.headerLoteService.saveDto(headerLoteNew);
    }  
    //vai no banco e retorna o header arquivo corrente ja com o header do lote
    var headerArquivoUpdated = await this.headerArquivoService.findOne({id: headerArquivo.id});
    return headerArquivoUpdated?.headersLote.filter(h=>{
      h.codigoConvenioBanco === convenioBanco
    })[0];   
  }

  private async getuser(userId: number){
    return await this.userService.getOne({id: userId});
  }

  private async gerarDetalheAB(headerLote: HeaderLote,ordem:OrdemPagamentoAgrupado,nsr?:number){
    const detalheA = HeaderLoteToDetalheA.convert(headerLote, ordem, nsr);
    const detalheASavesd = await this.detalheAService.save(detalheA);
    const detalheB = DetalheAToDetalheB.convert(detalheASavesd,ordem)
    await this.detalheBService.save(detalheB);
    return detalheB.nsr;
  }

  private enviarRemessa(){

  }
}