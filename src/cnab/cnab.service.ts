import { Injectable } from '@nestjs/common';
import {
  endOfDay,
  isFriday,
  nextFriday,
  nextThursday,
  startOfDay,
  subDays,
} from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { cnabSettings } from 'src/settings/cnab.settings';
import { SettingsService } from 'src/settings/settings.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { yearMonthDayToDate } from 'src/utils/date-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { Between } from 'typeorm';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacaoStatus } from './entity/pagamento/item-transacao-status.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from './entity/pagamento/transacao-status.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { ItemTransacaoStatusEnum } from './enums/pagamento/item-transacao-status.enum';
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
   * Update Transacoes tables from Jaé (bigquery)
   *
   * Requirement: **Salvar novas transações Jaé** - {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, items 3}
   */
  public async saveTransacoesJae() {
    const METHOD = this.saveTransacoesJae.name;

    await this.compareTransacaoViewPublicacao();

    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    // 2. Update TransacaoBigquery
    await this.updateTransacaoBigquery();

    // 3. Update ordens
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek();
    await this.saveOrdens(ordens);

    // Log
    const msg = `Há ${ordens.length} ordens consideradas novas.`;
    if (ordens.length) {
      this.logger.log(`${msg}. Salvando os itens...`, METHOD);
    } else {
      this.logger.log(`${msg}. Nada a fazer.`, METHOD);
      return;
    }
  }

  async updateTransacaoBigquery() {
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek();
    const transacoesView = transacoesBq.map((i) =>
      TransacaoView.newFromBigquery(i),
    );
    this.logger.log(
      `Inserindo ${transacoesView.length} itens em TransacaoView...`,
    );
    await this.transacaoViewService.insertMany(transacoesView);
  }

  /**
   * Salvar transacoes e agrupados
   */
  async saveOrdens(ordens: BigqueryOrdemPagamentoDTO[]) {
    // 3. Save Transacao / ItemTransacao
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

      await this.saveAgrupamentos(ordem, pagador, favorecido);
    }

    await this.compareTransacaoViewPublicacao();
  }

  async compareTransacaoViewPublicacao() {
    const transacoesView = await this.getTransacoesView();
    const publicacoes = await this.getPublicacoes();
    for (const publicacao of publicacoes) {
      const transacaoViewIds = transacoesView
        .filter(
          (transacaoView) =>
            transacaoView.idOperadora ===
              publicacao.itemTransacao.idOperadora &&
            transacaoView.idConsorcio === publicacao.itemTransacao.idConsorcio,
        )
        .map((i) => i.id);
      await this.transacaoViewService.updateMany(transacaoViewIds, {
        arquivoPublicacao: { id: publicacao.id },
      });
    }
  }

  /**
   *
   */
  async getPublicacoes() {
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const qui = startOfDay(subDays(friday, 8));
    const qua = endOfDay(subDays(friday, 2));
    return await this.arqPublicacaoService.findMany({
      where: {
        itemTransacao: {
          dataOrdem: Between(qui, qua),
        },
      },
    });
  }

  async saveAgrupamentos(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    favorecido: ClienteFavorecido,
  ) {
    // 1. Verificar se as colunas de agrupamento existem nas tabelas agrupadas
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(nextThursday(startOfDay(dataOrdem)));
    let transacaoAg = await this.transacaoAgService.findOne({
      dataOrdem: fridayOrdem,
      pagador: { id: pagador.id },
      status: { id: TransacaoStatusEnum.created },
    });

    let itemAg: ItemTransacaoAgrupado | null = null;
    // Se existe TransacaoAgrupado
    if (transacaoAg) {
      // Create or update item
      itemAg = await this.itemTransacaoAgService.findOne({
        where: {
          transacaoAgrupado: { id: transacaoAg.id },
          idConsorcio: ordem.idConsorcio, // business rule
          status: { id: ItemTransacaoStatusEnum.created },
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

    // Senão, cria Transacao e Item
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
    const existing = await this.transacaoService.findOne({
      idOrdemPagamento: ordem.idOrdemPagamento,
      transacaoAgrupado: { id: transacaoAgId },
    });
    const transacao = new Transacao({
      ...(existing ? { id: existing.id } : {}),
      dataOrdem: ordem.dataOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      status: new TransacaoStatus(TransacaoStatusEnum.created),
      transacaoAgrupado: { id: transacaoAgId },
    });
    return await this.transacaoService.save(transacao);
  }

  getTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(nextThursday(startOfDay(dataOrdem)));
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
      status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
    });
    return item;
  }

  async saveItemTransacaoPublicacao(
    ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacao: Transacao,
    itemTransacaoAg: ItemTransacaoAgrupado,
  ) {
    const existing = await this.itemTransacaoService.findOne({
      where: {
        transacao: { id: transacao.id },
        idConsorcio: ordem.idConsorcio,
        idOperadora: ordem.idOperadora,
        idOrdemPagamento: ordem.idOrdemPagamento,
        status: { id: ItemTransacaoStatusEnum.created },
      },
    });
    const item = new ItemTransacao({
      ...(existing ? { id: existing.id } : {}),
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
      status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
      itemTransacaoAgrupado: { id: itemTransacaoAg.id },
    });
    await this.itemTransacaoService.save(item);
    const publicacao = await this.arquivoPublicacaoService.savePublicacaoDTO(
      item,
    );
    await this.arquivoPublicacaoService.save(publicacao);
  }

  async getTransacoesView() {
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const qua = startOfDay(subDays(friday, 9));
    const ter = endOfDay(subDays(friday, 3));
    const transacoesView = await this.transacaoViewService.find({
      datetimeProcessamento: Between(qua, ter),
    });
    return transacoesView;
  }

  // #endregion

  // #region saveTransacoesLancamento

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
    const newLancamentos = await this.lancamentoService.findToPayToday();

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

  // #endregion

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findManyRegisteredUsers();
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  /**
   * This task will:
   * 1. Read new Transacoes (with no data in CNAB tables yet, like headerArquivo etc)
   * 2. Generate CnabFile
   * 3. Save CnabFile to CNAB tables in database
   * 4. Upload CNAB string to SFTP
   *
   * @throws `Error` if any subtask throws
   */
  public async sendRemessa(tipo: PagadorContaEnum) {
    const METHOD = this.sendRemessa.name;
    let transacoes: Transacao[];
    if (tipo === PagadorContaEnum.CETT) {
      transacoes = await this.transacaoService.findAllNewTransacao(tipo);
    } else {
      const transacoesAg = await this.transacaoAgService.findAllNewTransacao(
        tipo,
      );
      transacoes = transacoesAg as unknown as Transacao[];
    }

    if (!transacoes.length) {
      this.logger.log(
        `Não há transações novas para gerar remessa, nada a fazer...`,
        METHOD,
      );
      return;
    }

    // Generate Remessas and send SFTP
    for (const _transacao of transacoes) {
      let transacao: Transacao | undefined;
      let transacaoAg: TransacaoAgrupado | undefined;
      if (tipo === PagadorContaEnum.ContaBilhetagem) {
        transacaoAg = _transacao as unknown as TransacaoAgrupado;
      } else {
        transacao = _transacao;
      }

      // Generate remessa
      const nsrSequence = await this.settingsService.getOneBySettingData(
        cnabSettings.any__cnab_current_nsr_sequence,
      );
      const cnabStr = await this.remessaRetornoService.generateSaveRemessa(
        transacao,
        transacaoAg,
      );
      if (!cnabStr) {
        this.logger.warn(
          `A Transação/Agrupado #${_transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`,
          METHOD,
        );
        await this.settingsService.updateBySettingData(
          cnabSettings.any__cnab_current_nsr_sequence,
          nsrSequence.value,
        );
        continue;
      }
      try {
        // saveRemessa(cnab);
        await this.sftpService.submitCnabRemessa(cnabStr);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar o CNAB, tentaremos enviar no próximo job...`,
          METHOD,
          error.stack,
        );
      }
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
      /** Busca remessa, salva status = retorno */
      await this.remessaRetornoService.saveRetorno(retorno104);
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
