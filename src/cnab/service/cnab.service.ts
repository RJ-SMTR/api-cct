import { Injectable, Logger } from '@nestjs/common';
import { SftpService } from 'src/sftp/sftp.service';
import { formatLog } from 'src/utils/log-utils';
import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { parseCnab240_104 } from '../utils/cnab-104-utils';
import { HeaderArquivoService } from './header-arquivo.service';
import { TransacaoService } from './transacao.service';

@Injectable()
export class CnabService {
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private transacaoService: TransacaoService,
    private sftpService: SftpService,
  ) { }

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
    const listAllTransacao = await this.transacaoService.getAll();
    for (const transacao of listAllTransacao) {
      if (!this.headerArquivoService.headerArquivoExists(transacao.id_transacao)) {
        const { cnabString, cnabTables } = await this.headerArquivoService.generateCnab(transacao);
        await this.headerArquivoService.saveRemessa(cnabTables);
        await this.sftpService.submitFromString(cnabString, 'arquivo/123-wip-rem.txt');
      }
    }
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

  public async getArquivoRetornoCNAB(){
    //await this.headerArquivoService.saveArquivoRetorno();
    await this.headerArquivoService.compareRemessaToRetorno();
  }

}