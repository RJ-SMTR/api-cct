import { Injectable, Logger } from '@nestjs/common';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { logError, logLog, logWarn } from 'src/utils/log-utils';
import { parseCnab240_104 } from '../utils/cnab-104-utils';
import { HeaderArquivoService } from './header-arquivo.service';
import { TransacaoService } from './transacao.service';
import { TransacaoTarget } from '../types/transacao/transacao-target.type';
import { ItemTransacaoService } from './item-transacao.service';

@Injectable()
export class CnabService {
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private transacaoService: TransacaoService,
    private itemTransacaoService: ItemTransacaoService,
    private sftpService: SftpService,
  ) { }


  /**
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week
   * 3. For every id_ordem not in table, add Transacao and every itemTransacao
   * for each ordemPgto with same
   */
  public async updateTransacaoFromJae(target: TransacaoTarget) {
    await this.transacaoService.updateTransacaoFromJae(target);
  }

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
        const cnab = await this.headerArquivoService.generateCnab(transacao);
        if (!cnab) {
          logWarn(this.logger, `A Transação #${transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`, METHOD);
          continue;
        }
        await this.headerArquivoService.saveRemessa(cnab.tables);
        await this.sftpService.submitCnabRemessa(cnab.string);
      } catch (error) {
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
      const retorno104 = parseCnab240_104(cnabString);
      await this.headerArquivoService.saveArquivoRetorno(retorno104);
      await this.headerArquivoService.compareRemessaToRetorno();
      await this.sftpService.backupCnabRetorno(cnabName, SftpBackupFolder.RetornoSuccess);
    }
    catch (error) {
      logError(this.logger,
        'Erro ao processar CNAB retorno, movendo para backup de erros e finalizando...',
        METHOD, error, error);
      await this.sftpService.backupCnabRetorno(cnabName, SftpBackupFolder.RetornoFailure);
      return;
    }
  }

}