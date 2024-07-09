import { Injectable } from '@nestjs/common';
import {
  endOfDay,
  isFriday,
  isSameDay,
  nextFriday,
  nextThursday,
  startOfDay,
  subDays
} from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { SettingsService } from 'src/settings/settings.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { UsersService } from 'src/users/users.service';
import { forChunk } from 'src/utils/array-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { yearMonthDayToDate } from 'src/utils/date-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { Between } from 'typeorm';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from './entity/pagamento/transacao-status.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { TransacaoStatusEnum } from './enums/pagamento/transacao-status.enum';
import { CnabFile104Extrato } from './interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { ItemTransacaoAgrupadoService } from './service/pagamento/item-transacao-agrupado.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoAgrupadoService } from './service/pagamento/transacao-agrupado.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import {
  getCnab104Errors,
  parseCnab240Extrato,
  parseCnab240Pagamento,
  stringifyCnab104File,
} from './utils/cnab/cnab-104-utils';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { Cnab104FormaLancamento } from './enums/104/cnab-104-forma-lancamento.enum';
import { HeaderLoteDTO } from './dto/pagamento/header-lote.dto';
import { CnabRegistros104Pgto } from './interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { CnabHeaderArquivo104 } from './interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { HeaderArquivoDTO } from './dto/pagamento/header-arquivo.dto';

/**
 * User cases for CNAB and Payments
 */
@Injectable()
export class CnabService {
  private logger: CustomLogger = new CustomLogger(CnabService.name, {
    timestamp: true,
  });

  constructor(
    private remessaRetornoService: RemessaRetornoService,
    private arqPublicacaoService: ArquivoPublicacaoService,
    private transacaoService: TransacaoService,
    private itemTransacaoService: ItemTransacaoService,
    private sftpService: SftpService,
    private extHeaderArquivoService: ExtratoHeaderArquivoService,
    private extHeaderLoteService: ExtratoHeaderLoteService,
    private extDetalheEService: ExtratoDetalheEService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private bigqueryTransacaoService: BigqueryTransacaoService,
    private transacaoViewService: TransacaoViewService,
    private usersService: UsersService,
    private transacaoAgService: TransacaoAgrupadoService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private readonly lancamentoService: LancamentoService,
    private arquivoPublicacaoService: ArquivoPublicacaoService,
    private settingsService: SettingsService,
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private detalheAService: DetalheAService,    
  ) {}

  // #region saveTransacoesJae

  /**
   * Gera status = 1 (criado)
   *
   * Cria ArquivoPublicacao
   *
   * Update Transacoes tables from Jaé (bigquery)
   *
   * Requirement: **Salvar novas transações Jaé** - {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, items 3}
   */
  public async saveTransacoesJae(daysBefore=0,consorcio:string,dataPgto: Date | undefined) {    
    // 1. Update cliente favorecido
     await this.updateAllFavorecidosFromUsers();
    // 2. Update TransacaoView
    await this.updateTransacaoViewBigquery(daysBefore,dataPgto);
    // 3. Update ordens
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(daysBefore);
    await this.saveOrdens(ordens,consorcio);
    //TODO: Colocar na leitura do retorno
    //await this.compareTransacaoViewPublicacao();
  }

  /**
   * Atualiza a tabela TransacaoView
   */
  async updateTransacaoViewBigquery(daysBack=0,dataPgto: Date | undefined) {
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek(daysBack,dataPgto,false)
    const trs = transacoesBq.filter(tr => new Date(tr.datetime_transacao) >= subDays(new Date(),daysBack));
   
    forChunk(trs, 1000, async (chunk) => {   
      const transacoes = chunk.map((i) =>TransacaoView.fromBigqueryTransacao(i));
      for(const tr of transacoes) {
        if(tr.modo == undefined || tr.modo == null) {
          continue;
        }
        await this.transacaoViewService.save(tr);        
      }       
      // await this.transacaoViewService.findExisting(transacoes,async (existing) => {
      //   await this.transacaoViewService.saveMany(existing, transacoes);
      // });
    });
  }

  /**
   * Salvar Transacao / ItemTransacao e agrupados
   */
  async saveOrdens(ordens: BigqueryOrdemPagamentoDTO[],consorcio="Todos") {
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
   

    for (const ordem of ordens) {
      const cpfCnpj = ordem.consorcioCnpj || ordem.operadoraCpfCnpj;

      if (!cpfCnpj) {
        continue;
      }
      const favorecido = await this.clienteFavorecidoService.findOne({
        where: { cpfCnpj: cpfCnpj }});
      if (!favorecido) {      
        continue;
      }      
    
      if (consorcio =='Todos'){
        await this.saveAgrupamentos(ordem, pagador, favorecido); 
      }else if(consorcio =='Van'){
        if(ordem.consorcio =='STPC' || ordem.consorcio == 'STPL'){ 
           if(
            //(favorecido.nome =='MARIA DA GUIA BARROS DA COSTA' && (ordem.dataOrdem >='2024-06-06' && ordem.dataOrdem <='2024-06-19'))
            //|| (favorecido.nome =='ROSEMAR FURTADO GONZALEZ' && (ordem.dataOrdem >='2024-06-06' && ordem.dataOrdem <='2024-06-19'))
            // || (favorecido.nome =='ROSEVAL PEREIRA DE SOUZA' && (ordem.dataOrdem >='2024-06-06' && ordem.dataOrdem <='2024-06-19'))
            // || (favorecido.nome =='JOAO SALES DE ALBUQUERQUE' && (ordem.dataOrdem >='2024-06-06' && ordem.dataOrdem <='2024-06-26'))
            // || (favorecido.nome =='JOSE DIAS XIMENES' && (ordem.dataOrdem >='2024-06-06' && ordem.dataOrdem <='2024-06-26'))
            // || (favorecido.nome =='EDUARDO CARLOS DE OLIVEIRA' && (ordem.dataOrdem >='2024-06-20' && ordem.dataOrdem <='2024-06-26'))
            // || (favorecido.nome =='FRANCISCO DE OLIVEIRA FARIAS' && (ordem.dataOrdem >='2024-06-20' && ordem.dataOrdem <='2024-06-26'))
            // || (favorecido.nome =='LUCIANO CALIXTO MARQUES' && (ordem.dataOrdem >='2024-06-20' && ordem.dataOrdem <='2024-06-26')) 
             (favorecido.nome =='RICHARD DA SILVA FILLIES')){                      
            await this.saveAgrupamentos(ordem, pagador, favorecido);  
           }          
        }  
      }else if(consorcio =='Empresa'){
        if(ordem.consorcio !='STPC' && ordem.consorcio != 'STPL'){          
           await this.saveAgrupamentos(ordem, pagador, favorecido);              
         }  
      }
    }
  }

  async compareTransacaoViewPublicacao(daysBefore = 0) {
    const transacoesView = await this.getTransacoesViewWeek(daysBefore);
    const publicacoes = this.getUniqueUpdatePublicacoes(await this.getPublicacoesWeek(daysBefore));
    for (const publicacao of publicacoes) {
      const transacoes = transacoesView.filter(
        (transacaoView) => transacaoView.idOperadora === publicacao.itemTransacao.idOperadora &&
          transacaoView.idConsorcio === publicacao.itemTransacao.idConsorcio &&
          isSameDay(transacaoView.datetimeProcessamento, subDays(publicacao.itemTransacao.dataOrdem, 1))
      );
      const transacaoIds = transacoes.map((i) => i.id);
      await this.transacaoViewService.updateMany(transacaoIds, {
        arquivoPublicacao: { id: publicacao.id },
      });
    }
  }

  getUniqueUpdatePublicacoes(publicacoes: ArquivoPublicacao[]) {
    const unique: ArquivoPublicacao[] = [];
    publicacoes.forEach((publicacao) => {
      const existing = ArquivoPublicacao.filterUnique(unique, publicacao)[0] as
        | ArquivoPublicacao | undefined;
      const ocourences = ArquivoPublicacao.filterUnique(publicacoes,publicacao)
      .sort((a, b) => b.itemTransacao.dataOrdem.getTime() - a.itemTransacao.dataOrdem.getTime());
      const paid = ocourences.filter((i) => i.isPago)[0] as
        | ArquivoPublicacao | undefined;
      const noErrors = ocourences.filter((i) => !i.getIsError())[0] as
        | ArquivoPublicacao | undefined;
      const recent = ocourences[0] as ArquivoPublicacao;

      if (!existing) {
        const newPublicacao = paid || noErrors || recent;
        unique.push(newPublicacao);
      }
    });
    return unique;
  }

  /**
   * Publicacao está associada com a ordem, portanto é sex-qui
   */
  async getPublicacoesWeek(daysBefore = 0) {
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const sex = startOfDay(subDays(friday, 7 + daysBefore));
    const qui = endOfDay(subDays(friday, 1));
    const result = await this.arqPublicacaoService.findMany({
      where: { itemTransacao: { dataOrdem: Between(sex, qui)} },
      order: { itemTransacao: { dataOrdem: 'ASC' } }
    });
    return result;
  }

  /**
   * Salvar:
   * - TransacaoAgrupado (CNAB)
   * - ItemTransacaoAgrupado ()
   * - Transacao 
   */
  async saveAgrupamentos(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    favorecido: ClienteFavorecido,
  ) {
    /** TransaçãoAg por pagador(cpfCnpj), dataOrdem (sexta) e status = criado
     * Status criado
     */
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(startOfDay(dataOrdem));
    /**
     * Um TransacaoAgrupado representa um pagador.
     * Pois cada CNAB representa 1 conta bancária de origem
     */
    let transacaoAg = await this.transacaoAgService.findOne({
      dataOrdem: fridayOrdem,
      pagador: { id: pagador.id },
      status: { id: TransacaoStatusEnum.created },
    });

    /** ItemTransacaoAg representa o destinatário (operador ou consórcio) */
    let itemAg: ItemTransacaoAgrupado | null = null;

    if (transacaoAg) {
      // Cria ou atualiza itemTransacao (somar o valor a ser pago na sexta de pagamento)
      itemAg = await this.itemTransacaoAgService.findOne({
        where: {
          transacaoAgrupado: { id: transacaoAg.id, status: { id: TransacaoStatusEnum.created }},
          /**
           * Agrupar por destinatário (idOperadora).
           *
           * Se consorcio for STPC, agrupa pela operadora
           * Senão, agrupa pelo consórico
           */
          ...(ordem.consorcio === 'STPC' ? { idOperadora: ordem.idOperadora }: { idConsorcio: ordem.idConsorcio }),
        },
      });
      if (itemAg) {
        itemAg.valor += asNumber(ordem.valorTotalTransacaoLiquido);
      } else {
        itemAg = this.convertItemTransacaoAgrupadoDTO(ordem, favorecido, transacaoAg);
      }
      await this.itemTransacaoAgService.save(itemAg);
    }else { // Se não existir, cria Transacao e Item
      transacaoAg = await this.saveTransacaoAgrupado(ordem,pagador);
      itemAg = await this.saveItemTransacaoAgrupado(ordem, favorecido, transacaoAg);      
    }
    const transacao = await this.saveTransacao(ordem, pagador, transacaoAg.id);
    await this.saveItemTransacaoPublicacao(ordem, favorecido, transacao, itemAg );
  }

  private async saveTransacaoAgrupado(ordem: BigqueryOrdemPagamentoDTO,pagador:Pagador){
    const transacaoAg = this.convertTransacaoAgrupadoDTO(ordem, pagador);
    return await this.transacaoAgService.save(transacaoAg);      
  }

  private async saveItemTransacaoAgrupado(ordem: BigqueryOrdemPagamentoDTO,favorecido:ClienteFavorecido,transacaoAg:TransacaoAgrupado){
    const itemAg = this.convertItemTransacaoAgrupadoDTO(ordem, favorecido,transacaoAg);
    return await this.itemTransacaoAgService.save(itemAg);
  }  

  /**
   * Save or update Transacao.
   *
   * Unique id: `idOrdemPagamento`
   */
  async saveTransacao(ordem: BigqueryOrdemPagamentoDTO,pagador: Pagador, transacaoAgId: number): Promise<Transacao> {
    const transacao = this.convertTransacao(ordem,pagador,transacaoAgId);
    return await this.transacaoService.save(transacao);
  }

  private convertTransacao(ordem: BigqueryOrdemPagamentoDTO,pagador: Pagador,transacaoAgId: number){
    return new Transacao({
      dataOrdem: ordem.dataOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      transacaoAgrupado: { id: transacaoAgId }
    });    
  }

  convertTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    /** semana de pagamento: sex-qui */
    const fridayOrdem = nextFriday(startOfDay(dataOrdem));
    const transacao = new TransacaoAgrupado({
      dataOrdem: fridayOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      status: new TransacaoStatus(TransacaoStatusEnum.created),
    });
    return transacao;
  }

  convertItemTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,transacaoAg: TransacaoAgrupado) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(nextThursday(startOfDay(dataOrdem)));
    const item = new ItemTransacaoAgrupado({
      clienteFavorecido: favorecido,
      dataCaptura: ordem.dataOrdem,
      dataOrdem: fridayOrdem,
      idConsorcio: ordem.idConsorcio,
      idOperadora: ordem.idOperadora,
      idOrdemPagamento: ordem.idOrdemPagamento,
      nomeConsorcio: ordem.consorcio,
      nomeOperadora: ordem.operadora,
      valor: ordem.valorTotalTransacaoLiquido,
      transacaoAgrupado: transacaoAg,
    });
    return item;
  }

  async saveItemTransacaoPublicacao(
    ordem: BigqueryOrdemPagamentoDTO, favorecido: ClienteFavorecido, transacao: Transacao,
     itemTransacaoAg: ItemTransacaoAgrupado
  ) {
    const item = this.convertItemTransacao(ordem,favorecido,transacao,itemTransacaoAg);
    await this.itemTransacaoService.save(item);    
    await this.arquivoPublicacaoService.save(item);
  }

  private convertItemTransacao(ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacao: Transacao,
    itemTransacaoAg: ItemTransacaoAgrupado){
      return new ItemTransacao({
        clienteFavorecido: favorecido,
        dataCaptura: ordem.dataOrdem,
        dataOrdem: startOfDay(new Date(ordem.dataOrdem)),
        idConsorcio: ordem.idConsorcio,
        idOperadora: ordem.idOperadora,
        idOrdemPagamento: ordem.idOrdemPagamento,
        nomeConsorcio: ordem.consorcio,
        nomeOperadora: ordem.operadora,
        valor: ordem.valorTotalTransacaoLiquido,
        transacao: transacao,
        itemTransacaoAgrupado: { id: itemTransacaoAg.id }
      });
    }

  async getTransacoesViewWeek(daysBefore = 0) {
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const startDate = startOfDay(subDays(friday, 8 + daysBefore));
    const endDate = endOfDay(subDays(friday, 2));
    return await this.transacaoViewService.find({datetimeProcessamento: Between(startDate,endDate)},false);
  }

  // #endregion

  /**
   * Update Transacoes tables from Lancamento (api-cct)
   *
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Find new Lancamento from this week (qui-qua)
   * 3. Save new Transacao (status = created) / ItemTransacao (status = created)
   *
   * Requirement: **Salvar Transações de Lançamento** - {@link https://github.com/RJ-SMTR/api-cct/issues/188#issuecomment-2045867616 #188, items 1}
   */
  public async saveTransacoesLancamento() {
    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();
    // 2. Find new Lancamento from this week
    const newLancamentos = await this.lancamentoService.findToPayWeek();   

    // 3. Save new Transacao / ItemTransacao
    const favorecidos = newLancamentos.map((i) => i.id_cliente_favorecido);
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
    // It will automatically update Lancamentos via OneToMany
    const transacaoDTO = this.transacaoService.generateDTOForLancamento(pagador, newLancamentos);
    const savedTransacao = await this.transacaoService.saveForLancamento(transacaoDTO);
    const updatedLancamentos = savedTransacao.lancamentos as LancamentoEntity[];
    // .findByLancamentos(savedTransacao.lancamentos as LancamentoEntity[])
    const itemTransacaoDTOs = this.itemTransacaoService.generateDTOsFromLancamentos(updatedLancamentos, favorecidos);
    await this.itemTransacaoService.saveMany(itemTransacaoDTOs);    
  }

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findManyRegisteredUsers();
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  /**
   * Muda status de criado para remessa
   *
   * This task will:
   * 1. Read new Transacoes (with no data in CNAB tables yet, like headerArquivo etc)
   * 2. Generate CnabFile
   * 3. Save CnabFile to CNAB tables in database
   * 4. Upload CNAB string to SFTP
   *
   * @throws `Error` if any subtask throws
   */
  public async generateRemessa(tipo: PagadorContaEnum, dataPgto: Date | undefined, isConference: boolean,
     isCancelamento: boolean, nsaInicial: number, nsaFinal: number,dataCancelamento=new Date()):Promise<string[]>{
    const METHOD = this.sendRemessa.name;    

    const listCnab:string[] = [];
    if(!isCancelamento){
      const transacoesAg =  await this.transacaoAgService.findAllNewTransacao(tipo);
      if (!transacoesAg.length) {
        this.logger.log(`Não há transações novas para gerar remessa, nada a fazer...`,METHOD);
        return [];
      }
      // Generate Remessas and send SFTP
      for (const transacaoAg of transacoesAg){               
        const headerArquivoDTO = await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg,isConference);
        const lotes = await this.remessaRetornoService.getLotes(transacaoAg.pagador,headerArquivoDTO,dataPgto,isConference);        
        const cnab104 = this.remessaRetornoService.generateFile(headerArquivoDTO,lotes);
        if (headerArquivoDTO && cnab104){             
          const [cnabStr, processedCnab104] = stringifyCnab104File(cnab104,true,'CnabPgtoRem');
          for (const processedLote of processedCnab104.lotes){
            const savedLote = lotes.filter(i => i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
            await this.remessaRetornoService.updateHeaderLoteDTOFrom104(savedLote, processedLote.headerLote,isConference);
          }           
          if(!isConference){ //conferencia não atualiza status remessa
            await this.updateStatusRemessa(headerArquivoDTO,processedCnab104.headerArquivo,transacaoAg.id)
          }
          if(cnabStr){         
            listCnab.push(cnabStr);       
          }    
        }             
      }
    }else{ //Se for cancelamento 
      if(this.validateCancel(nsaInicial,nsaFinal)){
        return [];
      }
      
      if(nsaFinal == undefined || nsaFinal == 0){
        nsaFinal = nsaInicial;
      }

      for (let index = nsaInicial; nsaInicial < nsaFinal+1; nsaInicial++) {
        const headerArquivoDTO = await this.getHeaderArquivoCancelar(index);
        headerArquivoDTO.nsa = await this.headerArquivoService.getNextNSA();
        const lotes = await this.getLotesCancelar(index);        
        const lotesDto: HeaderLoteDTO[] = [];
        let detalhes: CnabRegistros104Pgto[] = [];
        for(const lote of lotes){
          const headerLoteDTO = this.headerLoteService.convertHeaderLoteDTO(headerArquivoDTO,lote.pagador,lote.formaLancamento == '41'?
            Cnab104FormaLancamento.TED:Cnab104FormaLancamento.CreditoContaCorrente);
          const detalhesA  = (await (this.detalheAService.findMany({ headerLote:{ id: lote.id } })))             
          .sort((a,b) => a.nsr - b.nsr);
          for(const detalheA of detalhesA){            
            const detalhe = await this.remessaRetornoService.saveDetalhes104(detalheA.numeroDocumentoEmpresa,headerLoteDTO,
              detalheA.itemTransacaoAgrupado, detalheA.nsr, detalheA.dataVencimento,false,true,detalheA);
            if(detalhe){             
              detalhes.push(detalhe);
            }
          }
          headerLoteDTO.registros104 = detalhes;               
          lotesDto.push(headerLoteDTO);   
          detalhes = [];           
        }           
        const cnab104 = this.remessaRetornoService.generateFile(headerArquivoDTO,lotesDto,true,dataCancelamento);
        if(headerArquivoDTO && cnab104){
          const [cnabStr, ] = stringifyCnab104File(cnab104,true,'CnabPgtoRem');
          if (!cnabStr) {           
            continue;
          }          
          listCnab.push(cnabStr);
        }        
      }
    }
    return listCnab;
  }  

  private async updateStatusRemessa(headerArquivoDTO:HeaderArquivoDTO,cnabHeaderArquivo:CnabHeaderArquivo104,transacaoAgId:number){
    await this.remessaRetornoService.updateHeaderArquivoDTOFrom104(headerArquivoDTO,cnabHeaderArquivo);
    await this.transacaoAgService.save({ id: transacaoAgId, status: new TransacaoStatus(TransacaoStatusEnum.remessa) });
  }

  private validateCancel(nsaInicial:number,nsaFinal:number){
    return (nsaInicial == undefined && nsaFinal ==undefined || (nsaFinal!=0 && nsaFinal < nsaInicial));      
  }
  
  
  private async getLotesCancelar(nsa: number) {
     return (await (this.headerLoteService.findMany({ headerArquivo:{ nsa: nsa }}))).sort((a,b) => a.loteServico - b.loteServico);
  }
 
  private async getHeaderArquivoCancelar(nsa: number) {
    return await this.headerArquivoService.getHeaderArquivoNsa(nsa); 
  }
  
  public async sendRemessa(listCnab:string[]){
    for(const cnabStr of listCnab){      
      await this.sftpService.submitCnabRemessa(cnabStr);       
    }
  }

  /**
   * This task will:
   * 1. Get first retorno from SFTP
   * 2. Save retorno to CNAB tables
   * 3.  - If successfull, move retorno to backup folder.
   *     - If failed, move retorno to backup/failure folder
   */
  public async updateRetorno() {
    const METHOD = this.updateRetorno.name;
    // Get retorno
    const { cnabString, cnabName } =
      await this.sftpService.getFirstCnabRetorno();
    if (!cnabName || !cnabString) {
      this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Pagamento(cnabString);
      /** Pega o status 2, muda para 3 */
      await this.remessaRetornoService.saveRetorno(retorno104);
      /** Pega status 3, muda para 4 */
      await this.arqPublicacaoService.compareRemessaToRetorno();
      const isCnabAccepted = getCnab104Errors(retorno104).length === 0;

      const logHasErrors = isCnabAccepted
        ? 'foi aceito.'
        : 'possui erros de aceitação do banco.';
      this.logger.log(
        `Retorno lido com sucesso, ${logHasErrors} Enviando para o backup...`,
        METHOD,
      );
      if (!isCnabAccepted) {
        await this.settingsService.revertNSR();
      } else {
        await this.settingsService.confirmNSR();
      }
      await this.sftpService.moveToBackup(
        cnabName,
        SftpBackupFolder.RetornoSuccess);
    } catch (error) {
      this.logger.error(
        `Erro ao processar CNAB retorno, movendo para backup de erros e finalizando... - ${error}`,
        error.stack,
        METHOD,
      );

      /**
       * Reverte o NSR pois o sistema está preparado para ler um retorno no formato acordado.
       * Se a leitura falhar, entendemos que não é um retorno válido, ignoramos o arquivo.
       */
      await this.settingsService.revertNSR();

      await this.sftpService.moveToBackup(
        cnabName,
        SftpBackupFolder.RetornoFailure,
      );
      return;
    }
  }

  // #region saveExtrato

  /**
   * This task will:
   * 1. Get extrato from SFTP
   * 2. Save extrato to CNAB tables
   * 3.  - If successfull, move retorno to backup folder.
   *     - If failed, move retorno to backup/failure folder
   */
  public async saveExtrato() {
    const METHOD = 'updateExtrato()';
    // Get retorno
    const cnab = await this.sftpService.getFirstCnabExtrato();
    if (!cnab) {
      this.logger.log('Extrato não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Extrato(cnab.content);
      await this.saveExtratoFromCnab(retorno104);
      await this.sftpService.moveToBackup(
        cnab.name,
        SftpBackupFolder.RetornoSuccess,
      );
    } catch (error) {
      this.logger.error(
        'Erro ao processar CNAB extrato, movendo para backup de erros e finalizando...',
        error,METHOD);
        await this.sftpService.moveToBackup(
        cnab.name,
        SftpBackupFolder.RetornoFailure,
      );
      return;
    }
  }

  private async saveExtratoFromCnab(cnab: CnabFile104Extrato) {
    const saveHeaderArquivo = await this.extHeaderArquivoService.saveFrom104(
      cnab.headerArquivo,
    );
    for (const lote of cnab.lotes) {
      const saveHeaderLote = await this.extHeaderLoteService.saveFrom104(
        lote.headerLote,
        saveHeaderArquivo.item,
      );
      for (const registro of lote.registros) {
        await this.extDetalheEService.saveFrom104(
          registro.detalheE,
          saveHeaderLote,
        );
      }
    }
  }
  // #endregion
}
