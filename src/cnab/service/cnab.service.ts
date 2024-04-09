import { Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Pagador } from '../entity/pagamento/pagador.entity';
import { Transacao } from '../entity/pagamento/transacao.entity';
import { CnabFile104Extrato } from '../interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabRemessaDTO } from '../interfaces/cnab-all/cnab-remsesa.interface';
import { parseCnab240Extrato, parseCnab240Pagamento } from '../utils/cnab/cnab-104-utils';
import { ArquivoPublicacaoService } from './arquivo-publicacao.service';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { ExtratoDetalheEService } from './extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './extrato/extrato-header-lote.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';
import { PagadorService } from './pagamento/pagador.service';
import { RetornoService } from './pagamento/pagamento.service';
import { TransacaoService } from './pagamento/transacao.service';

@Injectable()
export class CnabService {
  private logger: Logger = new CustomLogger('CnabService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private pagamentoService: RetornoService,
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
    private usersService: UsersService,
  ) { }

  // #region updateTransacaoFromJae

  /**
   * Update _Pagamento_ tables (Transacao and ItemTransacao etc) from Bigquery (Jaé)
   * 
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week + days before
   * 3. Bulk add new Transacao/ItemTransacao to save time
   * 4. If error, save individually via saveIfNotExists
   * 
   * Requirement: **Salvar ordem de pagamento** - {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, items 3.x}
   */
  public async updatePagamento() {
    const METHOD = this.updatePagamento.name;

    // Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    const ordens = await this.getOrdemPagamento();

    // Log
    const msg = `Há ${ordens.length} ordens consideradas novas.`;
    if (ordens.length) {
      this.logger.log(`${msg}. Salvando os itens...`, METHOD);
    } else {
      this.logger.log(`${msg}. Nada a fazer.`, METHOD);
      return;
    }

    // Save Transacao
    const favorecidos = await this.clienteFavorecidoService.findManyFromOrdens(ordens);
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
    const publicacaoDTOs = this.getManyPublicacaoDTO(ordens, pagador, favorecidos);
    const transacaoDTOs = this.getManyTransacaoDTO(publicacaoDTOs, pagador);
    const newTransacoes = await this.transacaoService.saveManyIfNotExists(transacaoDTOs);
    const newPublicacaoDTOs = this.updateNewPublicacaoDTO(publicacaoDTOs, newTransacoes);
    await this.arqPublicacaoService.saveMany(newPublicacaoDTOs);
    const itensTransacaoDTO = this.getManyItemTransacaoDTO(newPublicacaoDTOs, pagador, favorecidos);
    await this.itemTransacaoService.saveMany(itensTransacaoDTO);

    this.logger.log('Transações inseridas de uma vez com sucesso', METHOD);
  }

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findManyRegisteredUsers();
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  /**
   * Get BigqueryOrdemPagamento items.
   */
  private async getOrdemPagamento(): Promise<BigqueryOrdemPagamentoDTO[]> {
    return await this.bigqueryOrdemPagamentoService.getAllWeek();
  }

  private getManyPublicacaoDTO(
    ordens: BigqueryOrdemPagamentoDTO[],
    pagador: Pagador,
    favorecidos: ClienteFavorecido[],
  ): ArquivoPublicacao[] {
    const publicacoes: ArquivoPublicacao[] = [];
    for (const ordem of ordens) {
      // Get ClienteFavorecido
      const favorecido: ClienteFavorecido | undefined = favorecidos.filter(i =>
        i.cpfCnpj === ordem.operadoraCpfCnpj ||
        i.cpfCnpj === ordem.consorcioCnpj
      )[0];
      if (!favorecido) {
        // Ignore publicacao with no ClienteFavorecidos
        continue;
      }
      publicacoes.push(this.arqPublicacaoService.getArquivoPublicacaoDTO(ordem, pagador, favorecido));
    }
    return publicacoes;
  }

  /**
   * @returns Only new ArquivoPublicacoes. Those associated with new Transacao.
   */
  private updateNewPublicacaoDTO(
    publicacoes: ArquivoPublicacao[], createdTransacoes: Transacao[]
  ): ArquivoPublicacao[] {
    /** key: idOrdemPagamento */
    const transacaoMap: Record<string, Transacao> = createdTransacoes
      .reduce((map, i) => ({ ...map, [i.idOrdemPagamento]: i }), {});
    const newPublicacoes: ArquivoPublicacao[] = [];
    for (const publicacao of publicacoes) {
      const transacao = transacaoMap[publicacao.idOrdemPagamento];
      if (transacao) {
        publicacao.transacao = { id: transacao.id } as Transacao;
        newPublicacoes.push(publicacao);
      }
    }
    if (newPublicacoes.length !== publicacoes.length) {
      this.logger.warn(`${newPublicacoes.length}/${publicacoes.length} ArquivoPublicacoes novas `
        + '(associado com Transacao nova).')
    }
    return newPublicacoes;
  }

  private getManyTransacaoDTO(publicacoes: ArquivoPublicacao[], pagador: Pagador) {
    const transacoes: Transacao[] = [];
    /** key: idOrdemPagamento */
    const transacaoMap: Record<string, Transacao> = {};
    for (const publicacao of publicacoes) {
      const transacaoPK = publicacao.idOrdemPagamento;
      const newTransacao = this.transacaoService.getTransacaoDTO(publicacao, pagador);
      if (!transacaoMap[transacaoPK]) {
        transacoes.push(newTransacao);
        transacaoMap[publicacao.idOrdemPagamento] = newTransacao;
      }
    }
    return transacoes;
  }

  /**
   * @param publicacoes Ready to save or saved Entity. Must contain valid Transacao
   */
  private getManyItemTransacaoDTO(
    publicacoes: ArquivoPublicacao[],
    pagador: Pagador,
    favorecidos: ClienteFavorecido[],
  ): ItemTransacao[] {
    /** Key: cpfCnpj ClienteFavorecido. Eficient way to find favorecido. */
    const favorecidosMap: Record<string, ClienteFavorecido> =
      favorecidos.reduce((map, i) => ({ ...map, [i.cpfCnpj]: i }), {});

    /** Key: idOrdem, idConsorcio, idOperadora */
    const itensMap: Record<string, ItemTransacao> = {};

    // Mount DTOs
    for (const publicacao of publicacoes) {
      const favorecido = favorecidosMap[publicacao.cpfCnpjCliente];
      const itemPK = `${publicacao.idOrdemPagamento}|${publicacao.idConsorcio}|${publicacao.idOperadora}`;
      if (!itensMap[itemPK]) {
        itensMap[itemPK] = this.itemTransacaoService.getItemTransacaoDTO(publicacao, favorecido);
      }
      else {
        itensMap[itemPK].valor += publicacao.valorTotalTransacaoLiquido;
      }
    }
    return Object.values(itensMap);
  }

  // #endregion

  /**
   * This task will:
   * 1. Read new Transacoes (with no data in CNAB tables yet, like headerArquivo etc)
   * 2. Generate CnabFile
   * 3. Save CnabFile to CNAB tables in database
   * 4. Upload CNAB string to SFTP 
   * 
   * @throws `Error` if any subtask throws
   */
  public async sendRemessa() {
    const METHOD = this.sendRemessa.name;
    // Read new Transacoes
    const allNewTransacao = await this.transacaoService.findAllNewTransacao();

    // Retry all failed ItemTransacao to first new Transacao
    if (allNewTransacao.length > 0) {
      await this.itemTransacaoService.moveAllFailedToTransacao(allNewTransacao[0]);
    } else {
      this.logger.log('Sem Transações novas para criar CNAB. Tarefa finalizada.', METHOD);
      return;
    }

    const cnabs: CnabRemessaDTO[] = [];

    // Generate Remessas and send SFTP
    for (const transacao of allNewTransacao) {
      const cnab = await this.pagamentoService.generateCnabRemessa(transacao);
      if (!cnab) {
        this.logger.warn(
          `A Transação #${transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`, METHOD);
        continue;
      }
      try {
        await this.sftpService.submitCnabRemessa(cnab.string);
        cnabs.push(cnab.dto);
      }
      catch (error) {
        this.logger.error(
          `Falha ao enviar o CNAB, tentaremos enviar no próximo job...`, METHOD, error, error);
      }
    }

    // Save sent Remessas
    await this.pagamentoService.saveManyRemessa(cnabs);
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
      this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Pagamento(cnabString);
      await this.pagamentoService.saveRetorno(retorno104);
      await this.arqPublicacaoService.compareRemessaToRetorno();
      await this.sftpService.moveToBackup(cnabName, SftpBackupFolder.RetornoSuccess);
    }
    catch (error) {
      this.logger.error(
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
      await this.saveExtrato(retorno104);
      await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess);
    }
    catch (error) {
      this.logger.error(
        'Erro ao processar CNAB extrato, movendo para backup de erros e finalizando...',
        METHOD, error, error);
      // await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure);
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