import { Injectable } from '@nestjs/common';
import {
  endOfDay,
  isFriday,
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
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { UsersService } from 'src/users/users.service';

import { getChunks } from 'src/utils/array-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { yearMonthDayToDate } from 'src/utils/date-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { Between, DataSource, QueryRunner } from 'typeorm';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from './entity/pagamento/transacao-status.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { Cnab104FormaLancamento } from './enums/104/cnab-104-forma-lancamento.enum';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { TransacaoStatusEnum } from './enums/pagamento/transacao-status.enum';
import { CnabHeaderArquivo104 } from './interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabFile104Extrato } from './interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabRegistros104Pgto } from './interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { ItemTransacaoAgrupadoService } from './service/pagamento/item-transacao-agrupado.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoAgrupadoService } from './service/pagamento/transacao-agrupado.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import {
  parseCnab240Extrato,
  parseCnab240Pagamento,
  stringifyCnab104File,
} from './utils/cnab/cnab-104-utils';
import { HeaderLoteDTO } from './dto/pagamento/header-lote.dto';
import { HeaderArquivoDTO } from './dto/pagamento/header-arquivo.dto';
import { completeCPFCharacter } from 'src/utils/cpf-cnpj';
import { ConsorcioType } from './types/consorcio.type';

/**
 * User cases for CNAB and Payments
 */
@Injectable()
export class CnabService {
  private logger: CustomLogger = new CustomLogger(CnabService.name, {
    timestamp: true,
  });

  constructor(
    private arquivoPublicacaoService: ArquivoPublicacaoService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private bigqueryTransacaoService: BigqueryTransacaoService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private detalheAService: DetalheAService,
    private extDetalheEService: ExtratoDetalheEService,
    private extHeaderArquivoService: ExtratoHeaderArquivoService,
    private extHeaderLoteService: ExtratoHeaderLoteService,
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    private lancamentoService: LancamentoService,
    private pagadorService: PagadorService,
    private remessaRetornoService: RemessaRetornoService,
    private sftpService: SftpService,
    private transacaoAgService: TransacaoAgrupadoService,
    private transacaoService: TransacaoService,
    private transacaoViewService: TransacaoViewService,
    private usersService: UsersService,
    private dataSource: DataSource,
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
  public async saveTransacoesJae(
    dataOrdemIncial,
    dataOrdemFinal,
    daysBefore = 0,
    consorcio: string,
  ) {
    const dataOrdemInicialDate = startOfDay(new Date(dataOrdemIncial));
    const dataOrdemFinalDate = endOfDay(new Date(dataOrdemFinal));
    const consorcioType = consorcio as ConsorcioType;

    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();
    // 2. Update TransacaoView
    // await this.updateTransacaoViewBigquery( dataOrdemInicialDate,dataOrdemFinalDate, daysBefore, consorcioType);
    // 3. Update ordens
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemIncial,dataOrdemFinal,daysBefore);
    await this.saveOrdens(ordens,consorcio);  
  }

  /**
   * Atualiza a tabela TransacaoView
   */
  async updateTransacaoViewBigquery(
    dataOrdemIncial: Date,
    dataOrdemFinal: Date,
    daysBack = 0,
    consorcio: ConsorcioType = 'Todos',
  ) {
    const METHOD = this.updateTransacaoViewBigquery.name;
 
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek(
      dataOrdemIncial,dataOrdemFinal, daysBack);

    let trs = transacoesBq;
    if (consorcio === 'Van') {
      trs = transacoesBq.filter((tr) => tr.modo === consorcio);
    } else if (consorcio == 'Empresa') {
      trs = transacoesBq.filter((tr) => tr.modo !== 'Van');
    } else if (consorcio != 'Todos' &&
      consorcio != 'Empresa') {
      trs = transacoesBq.filter((tr) => tr.consorcio == consorcio);
    }


    const chunks = getChunks(trs, 1000);
    let iChunk = 0;
    const queryRunner = this.dataSource.createQueryRunner();   
    await queryRunner.connect();   
    try{
      await queryRunner.startTransaction();
      for (const chunk of chunks) {
        iChunk += 1;
        this.logger.log(`Atualizando ${iChunk}/${chunks.length} chunks`, METHOD);
        const transacoes = chunk.map((i) =>
          TransacaoView.fromBigqueryTransacao(i),
        );
        for (const tr of transacoes) {
          // const tr = TransacaoView.fromBigqueryTransacao(tra);
          if (
            tr.modo == undefined ||
            tr.modo == null ||
            tr.nomeOperadora == undefined ||
            tr.nomeOperadora == null
          ) {
            continue;
          }
          const existing = await this.transacaoViewService.find({ idTransacao: tr.idTransacao });
          await this.transacaoViewService.saveMany(existing,queryRunner, [tr]);
        }           
      }
      await queryRunner.commitTransaction();  
    }catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Falha ao salvar Informções agrupadas`,
        error?.stack,
      );
    }finally{
      await queryRunner.release();
    }
     
  }

  public async getTransacoesViewOrdem(ordem: BigqueryOrdemPagamentoDTO,clienteFavorecido: ClienteFavorecido){
      const trsDia = await this.getTransacoesViewWeek(
        subDays(new Date(ordem.dataOrdem), 1),new Date(ordem.dataOrdem));      
      const trsOrdem = trsDia.filter(
        (transacaoView) =>
          transacaoView.idOperadora === ordem.idOperadora &&
          transacaoView.idConsorcio === ordem.idConsorcio &&  
          transacaoView.operadoraCpfCnpj === clienteFavorecido.cpfCnpj          
      );    
      return trsOrdem;     
  }

  /**
   * Salvar Transacao / ItemTransacao e agrupados
   */
  async saveOrdens(ordens: BigqueryOrdemPagamentoDTO[], consorcio = 'Todos') {
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;

    for (const ordem of ordens) {
      const cpfCnpj = ordem.consorcioCnpj || ordem.operadoraCpfCnpj;
      if (!cpfCnpj) {
        continue;
      }
      const favorecido = await this.clienteFavorecidoService.findOne({
        where: { cpfCnpj: completeCPFCharacter(cpfCnpj, 0) },
      });
      if (!favorecido) {
        continue;
      }           

      if (consorcio == 'Todos' || consorcio == ordem.consorcio) {
        await this.saveAgrupamentos(ordem, pagador, favorecido);
      } else if (consorcio == 'Van') {
        if (ordem.consorcio == 'STPC' || ordem.consorcio == 'STPL') {
          // if(favorecido.nome==='JOSE DIAS XIMENES'
          //   || favorecido.nome==='JOAO SALES DE ALBUQUERQUE'
          //   || favorecido.nome==='EDUARDO CARLOS DE OLIVEIRA'
          //   || favorecido.nome==='AGUINALDO PAIVA RIBEIRO'
          //   || favorecido.nome==='DOMINGOS VIANA DA SILVA'
          //   || favorecido.nome==='ROSEVAL PEREIRA DE SOUZA'){
            await this.saveAgrupamentos(ordem, pagador, favorecido);
          // }          
        }
      } else if (consorcio == 'Empresa') {
        if (
          ordem.consorcio != 'STPC' &&
          ordem.consorcio != 'STPL' &&
          ordem.consorcio != 'VLT' ) {
          await this.saveAgrupamentos(ordem, pagador, favorecido);
        }
      }
    }
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
    favorecido: ClienteFavorecido   
  ) {
    const queryRunner = this.dataSource.createQueryRunner();   
    await queryRunner.connect();   
    let itemAg: ItemTransacaoAgrupado | null = null;
    try{
      await queryRunner.startTransaction();
      
      this.logger.debug('Salva Agrupamento Consorcio: '+ ordem.consorcio);
      /** TransaçãoAg por pagador(cpfCnpj), dataOrdem (sexta) e status = criado
       * Status criado
       */
      const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
      const fridayOrdem = nextFriday(startOfDay(dataOrdem));
      /**
       * Um TransacaoAgrupado representa um pagador.
       * Pois cada CNAB representa 1 conta bancária de origem
       */
      this.logger.debug('Inicia Consulta TransacaoAgrupado');
      let transacaoAg = await this.transacaoAgService.findOne({
        dataOrdem: fridayOrdem,
        pagador: { id: pagador.id },
        status: { id: TransacaoStatusEnum.created }
      }); 

      /** ItemTransacaoAg representa o destinatário (operador ou consórcio) */
     
    
      if (transacaoAg) {
        // Cria ou atualiza itemTransacao (somar o valor a ser pago na sexta de pagamento)
        this.logger.debug('Cria ou atualiza itemTransacaoAG');
        itemAg = await this.itemTransacaoAgService.findOne({
          where: {
            transacaoAgrupado: {
              id: transacaoAg.id,
              status: { id: TransacaoStatusEnum.created },
            },
            ...(ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL'?
               { idOperadora: ordem.idOperadora }: { idConsorcio: ordem.idConsorcio }),
          },
        });
        if (itemAg) {
          itemAg.valor += asNumber(ordem.valorTotalTransacaoLiquido);
        } else {
          itemAg = this.convertItemTransacaoAgrupadoDTO(
            ordem,transacaoAg);
        }
        await this.itemTransacaoAgService.save(itemAg,queryRunner);
        this.logger.debug('Fim Cria ou atualiza itemTransacaoAG');
      } else {        
        this.logger.debug('Save TransacaoAgrupado');
        transacaoAg = await this.saveTransacaoAgrupado(ordem, pagador);
        itemAg = await this.saveItemTransacaoAgrupado(ordem,transacaoAg,queryRunner);
        this.logger.debug('Fim Save TransacaoAgrupado');
      }
      this.logger.debug('Save Transacao');
      const transacao = await this.saveTransacao(ordem, pagador, transacaoAg.id,queryRunner);
      this.logger.debug('Fim Save Transacao');      
      this.logger.debug('Save ItemTransacaoPublicacao');      
      await this.saveItemTransacaoPublicacao(ordem,favorecido,transacao,itemAg,queryRunner);      
      this.logger.debug('Fim Save ItemTransacaoPublicacao');
      await queryRunner.commitTransaction();     
      this.logger.debug('Fim Agrupamento Consorcio: '+ ordem.consorcio); 
    }catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Falha ao salvar Informções agrupadas`,error?.stack);
    }finally{
      await queryRunner.release();     
    }
  }

  private async saveTransacaoAgrupado(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
  ) {
    const transacaoAg = this.convertTransacaoAgrupadoDTO(ordem, pagador);
    return await this.transacaoAgService.save(transacaoAg);
  }


  private async saveItemTransacaoAgrupado(
    ordem: BigqueryOrdemPagamentoDTO,
    transacaoAg: TransacaoAgrupado,
    queryRunner:QueryRunner
  ) {
    const itemAg = this.convertItemTransacaoAgrupadoDTO(ordem,transacaoAg);
    return await this.itemTransacaoAgService.save(itemAg,queryRunner);
  }

  /**
   * Save or update Transacao.
   *
   * Unique id: `idOrdemPagamento`
   */
  async saveTransacao(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    transacaoAgId: number,
    queryRunner: QueryRunner
  ): Promise<Transacao> {
    const transacao = this.convertTransacao(ordem, pagador, transacaoAgId);
    return await this.transacaoService.save(transacao,queryRunner);
  }

  private convertTransacao(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    transacaoAgId: number,
  ) {
    return new Transacao({
      dataOrdem: ordem.dataOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      transacaoAgrupado: { id: transacaoAgId },
    });
  }

  convertTransacaoAgrupadoDTO(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
  ) {
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

  convertItemTransacaoAgrupadoDTO(
    ordem: BigqueryOrdemPagamentoDTO,
    transacaoAg: TransacaoAgrupado,
  ) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(nextThursday(startOfDay(dataOrdem)));
    const item = new ItemTransacaoAgrupado({
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
    ordem: BigqueryOrdemPagamentoDTO, favorecido: ClienteFavorecido,
     transacao: Transacao, itemTransacaoAg: ItemTransacaoAgrupado,queryRunner:QueryRunner) {
    const item = this.convertItemTransacao(ordem,favorecido,transacao,itemTransacaoAg);  
    this.logger.debug('Save ItemTransacao: '+item.clienteFavorecido.nome);  
    await this.itemTransacaoService.save(item,queryRunner);
    const publicacao = 
      await this.arquivoPublicacaoService.convertPublicacaoDTO(item);
    this.logger.debug('Save Publicacao');
    await this.arquivoPublicacaoService.save(publicacao,queryRunner);
  }

  private convertItemTransacao(
    ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacao: Transacao,
    itemTransacaoAg: ItemTransacaoAgrupado,
  ) {
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
      itemTransacaoAgrupado: { id: itemTransacaoAg.id },
    });
  }

  async getTransacoesViewWeek(dataInicio: Date, dataFim: Date) {
    let friday = new Date();
    let startDate;
    let endDate;

    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }

    if (dataInicio != undefined && dataFim != undefined) {
      startDate = dataInicio;
      endDate = dataFim;
    } else {
      startDate = startOfDay(subDays(friday, 8));
      endDate = endOfDay(subDays(friday, 2));
    }
    return await this.transacaoViewService.find(
      { datetimeProcessamento: Between(startDate, endDate) },
      false,
    );   
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
    const transacaoDTO = this.transacaoService.generateDTOForLancamento(
      pagador,
      newLancamentos,
    );
    const savedTransacao = await this.transacaoService.saveForLancamento(
      transacaoDTO,
    );
    const updatedLancamentos = savedTransacao.lancamentos as LancamentoEntity[];
    // .findByLancamentos(savedTransacao.lancamentos as LancamentoEntity[])
    const itemTransacaoDTOs =
      this.itemTransacaoService.generateDTOsFromLancamentos(
        updatedLancamentos,
        favorecidos,
      );
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
  public async generateRemessa(
    tipo: PagadorContaEnum,
    dataPgto: Date | undefined,
    isConference: boolean,
    isCancelamento: boolean,
    nsaInicial: number,
    nsaFinal: number,
    dataCancelamento = new Date()    
  ): Promise<string[]> {
    const METHOD = this.sendRemessa.name;
    const queryRunner = this.dataSource.createQueryRunner();   
    await queryRunner.connect();   
    try{  
      await queryRunner.startTransaction();
      const listCnab: string[] = [];
      if (!isCancelamento) {
        const transacoesAg = await this.transacaoAgService.findAllNewTransacao(tipo);
        if (!transacoesAg.length) {
          this.logger.log(`Não há transações novas para gerar remessa, nada a fazer...`, METHOD);
          return [];
        }
        // Generate Remessas and send SFTP
        for (const transacaoAg of transacoesAg) {
          const headerArquivoDTO =
            await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg,isConference);
          const lotes = await this.remessaRetornoService.getLotes(
            transacaoAg.pagador,headerArquivoDTO,dataPgto,isConference);
          const cnab104 = this.remessaRetornoService.generateFile(
            headerArquivoDTO,
            lotes,
          );
          if (headerArquivoDTO && cnab104) {
            const [cnabStr, processedCnab104] = stringifyCnab104File(
              cnab104,true,'CnabPgtoRem');
            for (const processedLote of processedCnab104.lotes) {
              const savedLote = lotes.filter(
                (i) =>i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
                await this.remessaRetornoService.updateHeaderLoteDTOFrom104(
                savedLote,processedLote.headerLote,isConference);
            }
            if (!isConference) {
              //conferencia não atualiza status remessa
              await this.updateStatusRemessa(
                headerArquivoDTO, processedCnab104.headerArquivo,transacaoAg.id);
            }
            if (cnabStr) {
              listCnab.push(cnabStr);
            }
          }
        }
      } else {
        //Se for cancelamento
        if (this.validateCancel(nsaInicial, nsaFinal)) {
          return [];
        }

        if (nsaFinal == undefined || nsaFinal == 0) {
          nsaFinal = nsaInicial;
        }

        for (let index = nsaInicial; nsaInicial < nsaFinal + 1; nsaInicial++) {
          const headerArquivoDTO = await this.getHeaderArquivoCancelar(index);
          headerArquivoDTO.nsa = await this.headerArquivoService.getNextNSA();
          const lotes = await this.getLotesCancelar(index);
          const lotesDto: HeaderLoteDTO[] = [];
          let detalhes: CnabRegistros104Pgto[] = [];
          for (const lote of lotes) {
            const headerLoteDTO = this.headerLoteService.convertHeaderLoteDTO(
              headerArquivoDTO,
              lote.pagador,
              lote.formaLancamento == '41'
                ? Cnab104FormaLancamento.TED
                : Cnab104FormaLancamento.CreditoContaCorrente,
            );
            const detalhesA = (
              await this.detalheAService.findMany({ headerLote: { id: lote.id } })
            ).sort((a, b) => a.nsr - b.nsr);
            for (const detalheA of detalhesA) {
              const detalhe = await this.remessaRetornoService.saveDetalhes104(
                detalheA.numeroDocumentoEmpresa,
                headerLoteDTO,
                detalheA.itemTransacaoAgrupado,
                detalheA.nsr,
                detalheA.dataVencimento,
                false,
                true,
                detalheA                
              );
              if (detalhe) {
                detalhes.push(detalhe);
              }
            }
            headerLoteDTO.registros104 = detalhes;
            lotesDto.push(headerLoteDTO);
            detalhes = [];
          }
          const cnab104 = this.remessaRetornoService.generateFile(
            headerArquivoDTO,
            lotesDto,
            true,
            dataCancelamento,
          );
          if (headerArquivoDTO && cnab104) {
            const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
            if (!cnabStr) {
              continue;
            }
            listCnab.push(cnabStr);
          }
        }
      }      
      await queryRunner.commitTransaction();      
      return listCnab;
    }catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Falha ao salvar Informções agrupadas`,
        error?.stack,
      );
    }finally{
      await queryRunner.release();
    }
    return [];
  }

  private async updateStatusRemessa(
    headerArquivoDTO: HeaderArquivoDTO,
    cnabHeaderArquivo: CnabHeaderArquivo104,
    transacaoAgId: number,
  ) {
    await this.remessaRetornoService.updateHeaderArquivoDTOFrom104(
      headerArquivoDTO,
      cnabHeaderArquivo,
    );
    await this.transacaoAgService.save({
      id: transacaoAgId,
      status: new TransacaoStatus(TransacaoStatusEnum.remessa),
    });
  }

  private validateCancel(nsaInicial: number, nsaFinal: number) {
    return (
      (nsaInicial == undefined && nsaFinal == undefined) ||
      (nsaFinal != 0 && nsaFinal < nsaInicial)
    );
  }

  private async getLotesCancelar(nsa: number) {
    return (
      await this.headerLoteService.findMany({ headerArquivo: { nsa: nsa } })
    ).sort((a, b) => a.loteServico - b.loteServico);
  }

  private async getHeaderArquivoCancelar(nsa: number) {
    return await this.headerArquivoService.getHeaderArquivoNsa(nsa);
  }

  public async sendRemessa(listCnab: string[]) {
    for (const cnabStr of listCnab) {
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
    //Atualiza transacaoView com dados da publicacao

    const { cnabString, cnabName } =
      await this.sftpService.getFirstCnabRetorno();
    if (!cnabName || !cnabString) {
      this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }
    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Pagamento(cnabString);
      await this.remessaRetornoService.saveRetorno(retorno104);
      await this.sftpService.moveToBackup(cnabName,SftpBackupFolder.RetornoSuccess);
    } catch (error) {
      this.logger.error(
        `Erro ao processar CNAB retorno, movendo para backup de erros e finalizando... - ${error}`,
        error.stack,
        METHOD,
      );
      await this.sftpService.moveToBackup(
        cnabName,
        SftpBackupFolder.RetornoFailure,
      );
      return;
    }
  }

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
        error,
        METHOD,
      );
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
