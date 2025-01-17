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
import { HeaderLoteToDetalheA } from "../convertTo/header-lote-to-detalhe-a.convert";
import { DetalheAToDetalheB } from "../convertTo/detalhe-a-to-detalhe-b.convert";
import { HeaderArquivoToCnabFile } from "../convertTo/header-arquivo-to-cnabfile.convert";
import { ICnabInfo } from "src/cnab/cnab.service";
import { SftpService } from "src/sftp/sftp.service";
import { HeaderArquivoStatus, HeaderName } from "src/cnab/enums/pagamento/header-arquivo-status.enum";
import { StatusRemessaEnum } from "src/cnab/enums/novo-remessa/status-remessa.enum";
import { isEmpty } from "class-validator";
import { PagadorService } from "src/cnab/service/pagamento/pagador.service";
import { OrdemPagamentoAgrupadoHistorico } from "../entity/ordem-pagamento-agrupado-historico.entity";
import { DetalhesToCnab } from "../convertTo/detalhes-to-cnab.convert";
import { CnabRegistros104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { CnabFile104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface";
import { CnabHeaderLote104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface";
import { stringifyCnab104File } from "src/cnab/utils/cnab/cnab-104-utils";

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
    private userService: UsersService,
    private sftpService: SftpService,
    private pagadorService: PagadorService
  ) { }

  //PREPARA DADOS AGRUPADOS SALVANDO NAS TABELAS CNAB
  public async prepararRemessa(dataInicio: Date, dataFim: Date, consorcio?: string[]) {
    const ordens = await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio, dataFim, consorcio);
    const pagador = await this.pagadorService.getOneByIdPagador(ordens[0].pagadorId)
    if (!isEmpty(ordens)) {
      const headerArquivo = await this.gerarHeaderArquivo(pagador,this.getHeaderName(consorcio));
      let nsr = 1;
      let nsrAux = 0;
      ordens.forEach(async opa => {
        const op = await this.ordemPagamentoAgrupadoService.getOrdemPagamento(opa.id);
        if(op != null) {
          const user = await this.userService.getOne({ id: op.userId });
          if (user.bankCode) {            
            const headerLote = await this.gerarHeaderLote(headerArquivo,pagador,user.bankCode);
            if (headerLote) {
              nsrAux = await this.gerarDetalheAB(headerLote, op.ordemPagamentoAgrupado, nsr);
              if(nsrAux !== nsr){
                this.atualizaStatusRemessa(opa, StatusRemessaEnum.PreparadoParaEnvio);
                this.logger.debug(`Remessa preparado para: ${user.fullName}`)
                nsr = nsrAux++;
              }
            }
          }          
        }
      });
    }
  }  

  //PEGA INFORMAÇÕS DAS TABELAS CNAB E GERA O TXT PARA ENVIAR PARA O BANCO
  public async gerarCnabText(headerName:HeaderName): Promise<ICnabInfo[]> {
    const headerArquivo = await this.headerArquivoService.getExists(HeaderArquivoStatus._2_remessaGerado,headerName);
    if (headerArquivo) {
      const headerArquivoCnab = HeaderArquivoToCnabFile.convert(headerArquivo[0]);
      return await this.gerarListaCnab(headerArquivoCnab,headerArquivo[0])
    }
    return [];
  }

  private async gerarListaCnab(headerArquivoCnab,headerArquivo:HeaderArquivo){
    const listCnab: ICnabInfo[] = [];

    const trailerArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.trailerArquivo);

    const registros: CnabRegistros104Pgto[] = [];  
    
    const headersLote = await this.headerLoteService.findAll(headerArquivo.id);
        
    headersLote.forEach(async (headerLote:HeaderLote) => {
      
      const detalhesA = await this.detalheAService.findMany({headerLote:{id:headerLote.id}}); 

      detalhesA.forEach(async (detalheA) => {
         
        const detalheB = await this.detalheBService.findOne({detalheA:{id: detalheA.id}});
          if(detalheB) {
            const detalhes = await DetalhesToCnab.convert(detalheA, detalheB);        
            registros.push(detalhes);
          }
        });        

    });     

    const cnab104 = new CnabFile104PgtoDTO({
      headerArquivo: headerArquivoCnab,
      lotes: headersLote.map((headerLote) => ({
        headerLote: CnabHeaderLote104PgtoDTO.fromDTO(headerLote),
        registros: registros,
        trailerLote: structuredClone(Cnab104PgtoTemplates.file104.registros.trailerLote),
      })),
      trailerArquivo: trailerArquivo104,
    });

    if (cnab104) {
      const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
      if (!cnabStr) {
        this.logger.warn(`Não foi gerado um cnabString - headerArqId: ${headerArquivo.id}`);   
      }
      listCnab.push({ name: '', content: cnabStr, headerArquivo: headerArquivo });
    }
    return listCnab;
  }
  

  //PEGA O ARQUIVO TXT GERADO E ENVIA PARA O SFTP
  public async enviarRemessa(listCnab: ICnabInfo[]) {
    for (const cnab of listCnab) {
      cnab.name = await this.sftpService.submitCnabRemessa(cnab.content);
      const remessaName = ((l = cnab.name.split('/')) => l.slice(l.length - 1)[0])();
      await this.headerArquivoService.save({
        id: cnab.headerArquivo.id, remessaName,
        status: HeaderArquivoStatus._3_remessaEnviado
      });
    }
  }

  private async gerarHeaderArquivo(pagador: Pagador,remessaName:HeaderName) {  
    let headerArquivoExists = 
    await this.headerArquivoService.getExists( HeaderArquivoStatus._2_remessaGerado, remessaName )
    if(!headerArquivoExists) {
      const nsa = await this.settingsService.getNextNSA(false);
      const convertToHeader = OrdemPagamentoAgrupadoToHeaderArquivo.convert(pagador, nsa, remessaName);
      return await this.headerArquivoService.save(convertToHeader);
    }
    return headerArquivoExists[0];
  }

  private async gerarHeaderLote(headerArquivo: HeaderArquivo,pagador:Pagador, bankCode: number) {
    //verifica se existe header lote para o convenio para esse header arquivo  
    const headersLote = await this.headerLoteService.findAll( headerArquivo.id)
    const formaLancamento = (bankCode === 104) ? Cnab104FormaLancamento.CreditoContaCorrente : 
                    Cnab104FormaLancamento.TED;

    if(!isEmpty(headersLote)){
      var headerLote = headersLote.filter(h =>h.formaLancamento === formaLancamento);

      if (!headerLote) { //Se não existe cria
        return await this.criarHeaderLote(headerArquivo, pagador, formaLancamento)
      }else {
        return headerLote[0];
      }
    }else{
      return await this.criarHeaderLote(headerArquivo, pagador, formaLancamento)
    }     
  }

  private async gerarDetalheAB(headerLote: HeaderLote, ordem: OrdemPagamentoAgrupado, nsr: number) {    
    const hist = await this.ordemPagamentoAgrupadoService.getHistoricosOrdem(ordem.id);
    const ultimoHistorico  = hist[hist.length - 1]
    const detalheA = await this.existsDetalheA(ultimoHistorico)
    if(!detalheA) {
      const numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());  
      const detalheADTO = await HeaderLoteToDetalheA.convert(headerLote, ordem, nsr,ultimoHistorico,numeroDocumento);   
      const detalheASavesd = await this.detalheAService.save(detalheADTO);
      const detalheB = DetalheAToDetalheB.convert(detalheASavesd, ordem)
      await this.detalheBService.save(detalheB);
      return detalheB.nsr;
    }
    return nsr;
  }

  private async atualizaStatusRemessa(opa: OrdemPagamentoAgrupado, statusRemessa: StatusRemessaEnum) {
    const historico = await this.ordemPagamentoAgrupadoService.getHistoricosOrdem(opa.id);
    if (historico) {
      this.ordemPagamentoAgrupadoService.saveStatusHistorico(historico[historico.length-1], statusRemessa);
    }
  }

  private getHeaderName(consorcio: string[] | undefined): HeaderName {
    if(['VLT'].some(i=>consorcio?.includes(i))){
      return HeaderName.VLT;
    }else if(['STPC','STPL','TEC'].some(i=>consorcio?.includes(i))){
      return HeaderName.MODAL;
    }else{
      return HeaderName.CONSORCIO;
    }
  }

  private async criarHeaderLote(headerArquivo:HeaderArquivo,pagador:Pagador,formaPagamento:Cnab104FormaLancamento){
    var headerLoteNew = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivo, pagador,formaPagamento);
     return await this.headerLoteService.saveDto(headerLoteNew);
  }

  async existsDetalheA(ultimoHistorico: OrdemPagamentoAgrupadoHistorico) {
    const result  = await this.detalheAService.existsDetalheA(ultimoHistorico.id)
    return result;
  }
}

 

