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
  public async saveTransacoesJae(daysBefore = 0,consorcio='Todos') {
    const METHOD = this.saveTransacoesJae.name;

    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    // 2. Update TransacaoView
    await this.updateTransacaoViewBigquery(daysBefore);

    // 3. Update ordens
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(daysBefore);
    await this.saveOrdens(ordens,consorcio);

    //await this.compareTransacaoViewPublicacao();

    // Log
    const msg = `Há ${ordens.length} ordens consideradas novas.`;
    if (ordens.length) {
      this.logger.log(`${msg}. Salvando os itens...`, METHOD);
    } else {
      this.logger.log(`${msg}. Nada a fazer.`, METHOD);
      return;
    }
  }

  /**
   * Atualiza a tabela TransacaoView
   */
  async updateTransacaoViewBigquery(daysBack = 0) {
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek(
      daysBack,
      false,
    );

    forChunk(transacoesBq, 1000, async (chunk) => {   
      const transacoes = chunk.map((i) =>
        TransacaoView.fromBigqueryTransacao(i),
      );
      await this.transacaoViewService.findExisting(
        transacoes,
        async (existing) => {
          await this.transacaoViewService.saveMany(existing, transacoes);
        },
      );
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
        where: { cpfCnpj: cpfCnpj },
      });
      if (!favorecido) {      
        continue;
      }
      
      if (consorcio =='Todos'){
        await this.saveAgrupamentos(ordem, pagador, favorecido); 
      }else if(consorcio =='Van'){
        if(ordem.consorcio =='STPC' || ordem.consorcio == 'STPL'){          
           await this.saveAgrupamentos(ordem, pagador, favorecido);  
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
    const publicacoes = this.getUniqueUpdatePublicacoes(
      await this.getPublicacoesWeek(daysBefore),
    );
    for (const publicacao of publicacoes) {
      const transacoes = transacoesView.filter(
        (transacaoView) =>
          transacaoView.idOperadora === publicacao.itemTransacao.idOperadora &&
          transacaoView.idConsorcio === publicacao.itemTransacao.idConsorcio &&
          isSameDay(
            // Se a data é a mesma (d+0 vs d+1)
            transacaoView.datetimeProcessamento, // d+0
            subDays(publicacao.itemTransacao.dataOrdem, 1), // d+1
          ),
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
        | ArquivoPublicacao
        | undefined;
      const ocourences = ArquivoPublicacao.filterUnique(
        publicacoes,
        publicacao,
      ).sort(
        (a, b) =>
          b.itemTransacao.dataOrdem.getTime() -
          a.itemTransacao.dataOrdem.getTime(),
      );
      const paid = ocourences.filter((i) => i.isPago)[0] as
        | ArquivoPublicacao
        | undefined;
      const noErrors = ocourences.filter((i) => !i.getIsError())[0] as
        | ArquivoPublicacao
        | undefined;
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
      where: {
        itemTransacao: {
          dataOrdem: Between(sex, qui),
        },
      },
      order: {
        itemTransacao: {
          dataOrdem: 'ASC',
        },
      },
    });
    return result;
  }

  /**
   * Salvar:
   * - TransacaoAgrupado (CNAB)
   * - ItemTransacaoAgrupado ()
   * - Transacao
   * - 
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
          transacaoAgrupado: {
            id: transacaoAg.id,
            status: { id: TransacaoStatusEnum.created },
          },
          /**
           * Agrupar por destinatário (idOperadora).
           *
           * Se consorcio for STPC, agrupa pela operadora
           * Senão, agrupa pelo consórico
           */
          ...(ordem.consorcio === 'STPC'
            ? { idOperadora: ordem.idOperadora }
            : { idConsorcio: ordem.idConsorcio }),
        },
      });
      if (itemAg) {
        itemAg.valor += asNumber(ordem.valorTotalTransacaoLiquido);
      } else {
        itemAg = this.getItemTransacaoAgrupadoDTO(
          ordem,
          favorecido,
          transacaoAg,
        );
      }
      await this.itemTransacaoAgService.save(itemAg);
    }

    // Se não existir, cria Transacao e Item
    else {
      transacaoAg = this.getTransacaoAgrupadoDTO(ordem, pagador);
      transacaoAg = await this.transacaoAgService.save(transacaoAg);
      // Create item
      itemAg = this.getItemTransacaoAgrupadoDTO(ordem, favorecido, transacaoAg);
      itemAg = await this.itemTransacaoAgService.save(itemAg);
    }

    const transacao = await this.saveTransacao(ordem, pagador, transacaoAg.id);
    await this.saveItemTransacaoPublicacao(
      ordem,
      favorecido,
      transacao,
      itemAg,
    );
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
  ): Promise<Transacao> {
    const transacao = new Transacao({
      dataOrdem: ordem.dataOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      transacaoAgrupado: { id: transacaoAgId },
    });
    return await this.transacaoService.save(transacao);
  }

  getTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador) {
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

  getItemTransacaoAgrupadoDTO(
    ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacaoAg: TransacaoAgrupado,
  ) {
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
    ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacao: Transacao,
    itemTransacaoAg: ItemTransacaoAgrupado,
  ) {
    const item = new ItemTransacao({
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
    await this.itemTransacaoService.save(item);
    const publicacao = await this.arquivoPublicacaoService.savePublicacaoDTO(
      item,
    );
    await this.arquivoPublicacaoService.save(publicacao);
  }

  async getTransacoesViewWeek(daysBefore = 0) {
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const qui = startOfDay(subDays(friday, 8 + daysBefore));
    const qua = endOfDay(subDays(friday, 2));
    const transacoesView = await this.transacaoViewService.find(
      {
        datetimeProcessamento: Between(qui, qua),
      },
      false,
    );
    return transacoesView;
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
    const METHOD = this.saveTransacoesLancamento.name;

    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    // 2. Find new Lancamento from this week
    const newLancamentos = await this.lancamentoService.findToPayWeek();

    // Log
    const msg = `Há ${newLancamentos.length} Lancamentos considerados novos.`;
    if (newLancamentos.length > 0) {
      this.logger.log(`${msg}. Salvando os itens...`, METHOD);
    } else {
      this.logger.log(`${msg}. Nada a fazer.`, METHOD);
      return;
    }

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
    const newItemTransacoes = await this.itemTransacaoService.saveMany(
      itemTransacaoDTOs,
    );

    this.logger.log(
      `Foram inseridos com sucesso: 1 Transacao, ` +
        `${newItemTransacoes.length} ItemTransacoes;` +
        `e atualizados ${updatedLancamentos.length} Lancamentos`,
      METHOD,
    );
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
  public async saveRemessa(tipo: PagadorContaEnum) {
    const METHOD = this.sendRemessa.name;
    const transacoesAg = 
    await this.transacaoAgService.findAllNewTransacao(tipo);

    if (!transacoesAg.length) {
      this.logger.log(
        `Não há transações novas para gerar remessa, nada a fazer...`,
        METHOD,
      );
      return;
    }

    const listCnab:string[] = [];

    // Generate Remessas and send SFTP
    for (const transacaoAg of transacoesAg) {   

      // Get headerArquivo
      const headerArquivoDTO = await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg);

      const lotes = await this.remessaRetornoService.getLotes(transacaoAg.pagador,headerArquivoDTO);
      
      const cnab104 = this.remessaRetornoService.generateFile(headerArquivoDTO,lotes);

      if (!cnab104){
        return null;
      }
  
      // Process cnab
      const [cnabStr, processedCnab104] = stringifyCnab104File(cnab104,true,'CnabPgtoRem');

      for (const processedLote of processedCnab104.lotes){
        const savedLote =
         lotes.filter(i => i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
        await this.remessaRetornoService.updateHeaderLoteDTOFrom104(savedLote, processedLote.headerLote);
      }
  
      // Update
      await this.remessaRetornoService.updateHeaderArquivoDTOFrom104(headerArquivoDTO,processedCnab104.headerArquivo);

      await this.transacaoAgService.save({ id: transacaoAg.id, status: new TransacaoStatus(TransacaoStatusEnum.remessa) });

      if (!cnabStr) {
        this.logger.warn(
          `A TransaçãoAgrupado #${transacaoAg.id} gerou cnab vazio (sem itens válidos), ignorando...`,
          METHOD,
        );        
        continue;
      }
      try {
        listCnab.push(cnabStr);
       
      } catch (error) {
        this.logger.error(
          `Falha ao enviar o CNAB, tentaremos enviar no próximo job...`,
          METHOD,
          error.stack,
        );
      }      
    }
    return listCnab;
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
        SftpBackupFolder.RetornoSuccess,
      );
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
