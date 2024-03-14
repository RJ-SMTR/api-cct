import { Injectable, Logger } from '@nestjs/common';
import { format } from 'date-fns';
import { SftpService } from 'src/sftp/sftp.service';
import { getBRTFromUTC } from 'src/utils/date-utils';
import { formatLog } from 'src/utils/log-utils';
import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { parseCnab240_104 } from '../utils/cnab-104-utils';
import { HeaderArquivoService } from './header-arquivo.service';
import { TransacaoService } from './transacao.service';

@Injectable()
export class CnabService {
  private readonly REMESSA_FOLDER = '/remessa';
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private transacaoService: TransacaoService,
    private sftpService: SftpService,
  ) { }


  /**
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week
   * 3. For every id_ordem not in table, add Transacao and every itemTransacao
   * for each ordemPgto with same
   */
  public async updateTransacaoFromJae() {
    await this.transacaoService.updateTransacaoFromJae()
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
  public async updateRemessa() {
    // Read new Transacoes
    const listAllTransacao = await this.transacaoService.getAll();
    for (const transacao of listAllTransacao) {
      const headerExists = await this.headerArquivoService.findOne({
        transacao: { id: transacao.id },
      });
      if (!headerExists) {
        const { cnabString, cnabTables } = await this.headerArquivoService.generateCnab(transacao);
        await this.headerArquivoService.saveRemessa(cnabTables);
        await this.sftpService.submitFromString(cnabString, `${this.REMESSA_FOLDER}/${this.getRemessaName()}`);
      }
    }
  }

  /**
   * @example 'smtr_prefeiturarj_31122024_235959.txt'
   */
  private getRemessaName() {
    const now = getBRTFromUTC(new Date());
    const stringDate = format(now, `ddMMyy_HHmmss`);
    return `smtr_prefeiturarj_${stringDate}.txt`;
  }

  /**
   * This task will:
   * 1. Get retorno from SFTP
   * 2. Save retorno to CNAB tables
   * 3. If successfull, move retorno to backup folder
   * 
   * @throws `Error` if any subtask throws
   */
  public async updateRetorno() {
    const METHOD = 'updateRetorno()';
    // Get retorno
    const { cnabString, cnabName } = await this.sftpService.getFirstCnabRetorno();
    if (!cnabName || !cnabString) {
      this.logger.log(formatLog('Retorno não encontrado, abortando tarefa.', METHOD));
      return;
    }

    // Save retorno, move backup
    const retorno104 = parseCnab240_104(cnabString);
    if (this.salvarRetorno(retorno104)) {
      await this.sftpService.backupCnabRetorno(cnabName);
    }
  }

  // CHAMAR MÉTODO PARA SALVAR RETORNO NO BANCO
  salvarRetorno(a: ICnab240_104File): boolean {
    console.log(a);
    return true;
  }

  public async getArquivoRetornoCNAB() {
    //await this.headerArquivoService.saveArquivoRetorno();
    await this.headerArquivoService.compareRemessaToRetorno();
  }

}