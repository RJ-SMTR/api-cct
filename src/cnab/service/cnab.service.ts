import { Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryInvalidRows } from 'src/bigquery/interfaces/bigquery-invalid-rows.interface';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';
import { RoleEnum } from 'src/roles/roles.enum';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { UsersService } from 'src/users/users.service';
import { logError, logLog, logWarn } from 'src/utils/log-utils';
import { validateDTO } from 'src/utils/validation-utils';
import { IsNull, Not } from 'typeorm';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { CnabFile104Extrato } from '../interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { AllPagadorDict } from '../interfaces/pagamento/all-pagador-dict.interface';
import { parseCnab240Extrato, parseCnab240Pagamento } from '../utils/cnab-104-utils';
import { ArquivoPublicacaoService } from './arquivo-publicacao.service';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { ExtratoDetalheEService } from './extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './extrato/extrato-header-lote.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';
import { PagadorService } from './pagamento/pagador.service';
import { PagamentoService } from './pagamento/pagamento.service';
import { TransacaoService } from './pagamento/transacao.service';

@Injectable()
export class CnabService {
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private pagamentoService: PagamentoService,
    private arquivoPubService: ArquivoPublicacaoService,
    private transacaoService: TransacaoService,
    private itemTransacaoService: ItemTransacaoService,
    private sftpService: SftpService,
    private extHeaderArquivoService: ExtratoHeaderArquivoService,
    private extHeaderLoteService: ExtratoHeaderLoteService,
    private extDetalheEService: ExtratoDetalheEService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private usersService: UsersService,
  ) { }

  // #region updateTransacaoFromJae

  /**
   * Update Transacao and ItemTransacao from Bigquery (Jaé)
   * 
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week + days before
   * 3. Bulk add new Transacao/ItemTransacao to save time
   * 4. If error, save individually via saveIfNotExists
   */
  public async updateTransacaoFromJae() {
    const METHOD = 'updateTransacaoFromJae()';

    // Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    // Update ItemTransacao with no ClienteFavorecido
    const allFavorecidos = await this.clienteFavorecidoService.getAll();
    await this.itemTransacaoService.updateMissingFavorecidos(allFavorecidos);

    // Get items
    const ordens = await this.getOrdemPagamentoJae();
    const newOrdens = await this.filterNewOrdemPagamento(ordens);
    const pagadores = await this.pagadorService.getAllPagador();

    // Log
    const msgNewOrdens = `De ${ordens.length} Ordens há ${newOrdens.length} novas.`;
    if (newOrdens.length) {
      logLog(this.logger, `${msgNewOrdens}. Salvando cada item...`, METHOD);
    } else {
      logLog(this.logger, `${msgNewOrdens}. Nada a fazer.`, METHOD);
      return;
    }

    // Insert new Transacao/ItemTransacao
    try {
      await this.insertTransacaoBulk(newOrdens, pagadores, allFavorecidos);
      logLog(this.logger, 'Transações inseridas de uma vez com sucesso', METHOD);
    }
    catch (error) {
      logWarn(this.logger, 'Falha ao adicionar Transações de uma vez, adicionando individualmente...', METHOD);
      await this.insertTransacaoIndividually(newOrdens, pagadores, allFavorecidos);
      logLog(this.logger, 'Transações inseridas individualmente com sucesso', METHOD);
    }

  }

  /**
   * Insert Item/Transacao at once. It does not verify constraints or anything.
   */
  private async insertTransacaoBulk(
    newOrdens: BigqueryOrdemPagamentoDTO[],
    pagadores: AllPagadorDict,
    allFavorecidos: ClienteFavorecido[],
  ) {
    const transacaoResult = await this.transacaoService.saveManyNewFromOrdem(newOrdens, pagadores);
    const transacoes = [...transacaoResult.existing, ...transacaoResult.inserted];
    await this.itemTransacaoService.saveManyNewFromOrdem(transacoes, newOrdens, allFavorecidos);
  }

  /**
   * Save new Item/Transacao individually by performing saveIfNotExists()
   */
  private async insertTransacaoIndividually(
    newOrdens: BigqueryOrdemPagamentoDTO[],
    pagadores: AllPagadorDict,
    allFavorecidos: ClienteFavorecido[],
  ) {
    const METHOD = 'updateTransacaoFromJae->insertTransacaoIndividually()';
    const errors: BigqueryInvalidRows[] = [];
    for (const ordemPagamento of newOrdens) {
      const pagador = ordemPagamento.permissionarioRole === PermissionarioRoleEnum.vanzeiro
        ? pagadores.jae : pagadores.lancamento;

      // Add transacao
      const error = await validateDTO(BigqueryOrdemPagamentoDTO, ordemPagamento, false);
      if (Object.keys(error).length > 0) {
        errors.push({
          versao: ordemPagamento.versao,
          error: error,
        });
        continue;
      }
      const transacaoDTO = this.transacaoService.ordemPagamentoToTransacao(ordemPagamento, pagador.id);
      const saveTransacao = await this.transacaoService.saveIfNotExists(transacaoDTO);

      // Add itemTransacao
      // const favorecido = await this.clienteFavorecidoService.findCpfCnpj(ordemPagamento.favorecidoCpfCnpj);
      const favorecido = allFavorecidos.filter(i => i.cpfCnpj === ordemPagamento.favorecidoCpfCnpj).pop() || null;
      const itemTransacaoDTO = this.itemTransacaoService.ordemPagamentoToItemTransacaoDTO(
        ordemPagamento, saveTransacao.item.id, favorecido);
      await this.itemTransacaoService.saveIfNotExists(itemTransacaoDTO, true);
    }
    if (errors.length > 0) {
      logWarn(this.logger, `O bigquery retornou itens inválidos, ignorando: ${JSON.stringify(errors)}`, METHOD);
    }
  }

  // private saveNewTransacaoAndItem(ordens: BigqueryOrdemPagamentoDTO[], pagadores: AllPagadorDict) {
  // const uniqueTransacaoFromOrdem = getUniqueFromArray(ordens, ['']) 
  // const newTransacoes: TransacaoDTO[] = [];

  // }

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findMany({
      role: { id: RoleEnum.user, },
      fullName: Not(IsNull()),
      cpfCnpj: Not(IsNull()),
      bankCode: Not(IsNull()),
      bankAgency: Not(IsNull()),
      bankAccount: Not(IsNull()),
      bankAccountDigit: Not(IsNull()),
    });
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  /**
   * Get newest BigqueryOrdemPagamento items.
   */
  private async getOrdemPagamentoJae(): Promise<BigqueryOrdemPagamentoDTO[]> {
    return await this.bigqueryOrdemPagamentoService.getAllWeek(50);
    // const oldestSaved = await this.itemTransacaoService.getOldestBigqueryDate();
    // if (!oldestSaved) {
    //   return await this.bigqueryOrdemPagamentoService.getAll();
    // } else {
    // return await this.bigqueryOrdemPagamentoService.getAllWeek();
    // }
  }

  /**
   * Return OrdemPagamento containing only items not existing in database.
   */
  private async filterNewOrdemPagamento(ordens: BigqueryOrdemPagamentoDTO[]): Promise<BigqueryOrdemPagamentoDTO[]> {
    const existing = await this.itemTransacaoService.getExistingFromBQOrdemPagamento(ordens);
    const newOrdens = ordens.filter(o =>
      existing.filter(e =>
        e.idOrdemPagamento === o.idOrdemPagamento &&
        e.servico === o.servico &&
        e.idConsorcio === o.idConsorcio &&
        e.idOperadora === o.idOperadora
      ).length === 0
    );
    return newOrdens;
  }


  // #endregion

  /**
   * This task is used in 2 situations:
   * 1. To weekly update vanzeiros form Jaé
   * 2. To daily update other clients (e.g. consórcios)
   * 
   * This task will:
   * 1. Read new Transacoes (with no data in CNAB tables yet, like headerArquivo etc)
   * 2. Generate CnabFile
   * 3. Save CnabFile to CNAB tables in database
   * 4. Upload CNAB string to SFTP 
   * 
   * @throws `Error` if any subtask throws
   */
  public async updateRemessa() {
    const METHOD = 'updateRemessa()';
    // Read new Transacoes
    const allNewTransacao = await this.transacaoService.findAllNewTransacao();

    // Retry all failed ItemTransacao to first new Transacao
    if (allNewTransacao.length > 0) {
      await this.itemTransacaoService.moveAllFailedToTransacao(allNewTransacao[0]);
    }

    for (const transacao of allNewTransacao) {
      try {
        const cnab = await this.pagamentoService.generateCnabRemessa(transacao);
        if (!cnab) {
          logWarn(this.logger, `A Transação #${transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`, METHOD);
          continue;
        }
        const savedHeaderArquivo = await this.pagamentoService.saveCnabRemessa(cnab.tables);
        try {
          await this.sftpService.submitCnabRemessa(cnab.string);
          await this.headerArquivoService.save({
            id: savedHeaderArquivo.item.id,
            status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.remessaSent),
          });
        }
        catch (error) {
          logError(this.logger, `Falha ao enviar o CNAB, tentaremos enviar no próximo job...`, METHOD, error, error);
          await this.headerArquivoService.save({
            id: savedHeaderArquivo.item.id,
            status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.remessaSendingFailed),
          });
        }
      }
      catch (error) {
        logError(this.logger,
          `Ao adicionar a transação #${transacao.id} houve erro, ignorando...`, METHOD, error, error);
      }
    }

    // Log
    if (allNewTransacao.length === 0) {
      logLog(this.logger, 'Sem Transações novas para criar CNAB. Tarefa finalizada.', METHOD);
      return;
      // TODO: if no new Transacao but there is failed items, craete new Transacao to try again
    }
  }

  /**
   * This task will:
   * 1. Get retorno from SFTP
   * 2. Save retorno to CNAB tables
   * 3.  - If successfull, move retorno to backup folder.
   *     - If failed, move retorno to backup/failure folder
   */
  public async updateRetorno() {
    const METHOD = 'updateRetorno()';
    // Get retorno
    const { cnabString, cnabName } = await this.sftpService.getFirstCnabRetorno();
    if (!cnabName || !cnabString) {
      logLog(this.logger, 'Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Pagamento(cnabString);
      await this.pagamentoService.saveRetorno(retorno104);
      await this.arquivoPubService.compareRemessaToRetorno();
      await this.sftpService.moveToBackup(cnabName, SftpBackupFolder.RetornoSuccess);
    }
    catch (error) {
      logError(this.logger,
        'Erro ao processar CNAB retorno, movendo para backup de erros e finalizando...',
        METHOD, error, error);
      await this.sftpService.moveToBackup(cnabName, SftpBackupFolder.RetornoFailure);
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
  public async updateExtrato() {
    const METHOD = 'updateRetorno()';
    // Get retorno
    const cnab = await this.sftpService.getFirstCnabExtrato();
    if (!cnab) {
      logLog(this.logger, 'Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Extrato(cnab.content);
      await this.saveExtrato(retorno104);
      await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess);
    }
    catch (error) {
      logError(this.logger,
        'Erro ao processar CNAB extrato, movendo para backup de erros e finalizando...',
        METHOD, error, error);
      await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure);
      return;
    }
  }

  private async saveExtrato(cnab: CnabFile104Extrato) {
    const saveHeaderArquivo = await this.extHeaderArquivoService.saveFrom104(cnab.headerArquivo);
    for (const lote of cnab.lotes) {
      const saveHeaderLote =
        await this.extHeaderLoteService.saveFrom104(lote.headerLote, saveHeaderArquivo.item);
      for (const registro of lote.registros) {
        await this.extDetalheEService.saveFrom104(registro.detalheE, saveHeaderLote);
      }
    }
  }

}