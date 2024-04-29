import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { UsersService } from 'src/users/users.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { CustomLogger } from 'src/utils/custom-logger';
import { asString } from 'src/utils/pipe-utils';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { CnabFile104Extrato } from './interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabRemessaDTO } from './interfaces/cnab-all/cnab-remsesa.interface';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import {
  parseCnab240Extrato,
  parseCnab240Pagamento,
} from './utils/cnab/cnab-104-utils';

/**
 * User cases for CNAB and Payments
 */
@Injectable()
export class CnabService {
  private logger: CustomLogger = new CustomLogger('CnabService', {
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
    private usersService: UsersService,
    private readonly lancamentoService: LancamentoService,
  ) {}

  // #region saveTransacoesJae

  /**
   * Update Transacoes tables from Jaé (bigquery)
   *
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week
   * 3. Save new Transacao (status = created) / ItemTransacao (status = craeted)
   * 4. Save new ArquivoPublicacao
   *
   * Requirement: **Salvar novas transações Jaé** - {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, items 3}
   */
  public async saveTransacoesJae() {
    const METHOD = this.saveTransacoesJae.name;

    // 1. Update cliente favorecido
    await this.updateAllFavorecidosFromUsers();

    // 2. Fetch ordemPgto
    const ordens = await this.getOrdemPagamento();

    // Log
    const msg = `Há ${ordens.length} ordens consideradas novas.`;
    if (ordens.length) {
      this.logger.log(`${msg}. Salvando os itens...`, METHOD);
    } else {
      this.logger.log(`${msg}. Nada a fazer.`, METHOD);
      return;
    }

    // 3. Save Transacao / ItemTransacao
    const favorecidos = (
      await this.clienteFavorecidoService.findManyFromOrdens(ordens)
    ).filter((i) => isCpfOrCnpj(i.cpfCnpj) !== null);
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
    const publicacaoDTOs = this.arqPublicacaoService.generateDTOs(
      ordens,
      pagador,
      favorecidos,
    );
    const transacaoDTOs = this.transacaoService.generateDTOsFromPublicacoes(
      publicacaoDTOs,
      pagador,
    );
    const newTransacoes = await this.transacaoService.saveManyIfNotExists(
      transacaoDTOs,
    );
    const newPublicacaoDTOs = this.updateNewPublicacaoDTOs(
      publicacaoDTOs,
      newTransacoes,
    );
    const itemTransacaoDTOs =
      this.itemTransacaoService.generateDTOsFromPublicacoes(
        newPublicacaoDTOs,
        favorecidos,
      );
    const newItemTransacoes = await this.itemTransacaoService.saveMany(
      itemTransacaoDTOs,
    );

    // 4. Save new ArquivoPublicacao
    const savedPublicacoes = await this.arqPublicacaoService.saveMany(
      newPublicacaoDTOs,
    );

    this.logger.log(
      `Foram inseridos com sucesso: ${newTransacoes.length} Transacoes, ` +
        `${newItemTransacoes.length} ItemTransacoes, ${savedPublicacoes.length} ArquivoPublicacoes`,
      METHOD,
    );
  }

  /**
   * Get BigqueryOrdemPagamento items.
   */
  private async getOrdemPagamento(): Promise<BigqueryOrdemPagamentoDTO[]> {
    return await this.bigqueryOrdemPagamentoService.getFromWeek(90);
  }

  /**
   * @returns Only new ArquivoPublicacoes. Those associated with new Transacao.
   */
  private updateNewPublicacaoDTOs(
    publicacoes: ArquivoPublicacao[],
    createdTransacoes: Transacao[],
  ): ArquivoPublicacao[] {
    /** key: idOrdemPagamento */
    const transacaoMap: Record<string, Transacao> = createdTransacoes.reduce(
      (map, i) => ({ ...map, [asString(i.idOrdemPagamento)]: i }),
      {},
    );
    const newPublicacoes: ArquivoPublicacao[] = [];
    for (const publicacao of publicacoes) {
      const transacao = transacaoMap[publicacao.idOrdemPagamento];
      if (transacao) {
        publicacao.transacao = { id: transacao.id } as Transacao;
        newPublicacoes.push(publicacao);
      }
    }
    this.logger.debug(
      `${newPublicacoes.length}/${publicacoes.length} ArquivoPublicacoes novas ` +
        '(associado com Transacao nova).',
    );
    return newPublicacoes;
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
  public async sendRemessa() {
    const METHOD = this.sendRemessa.name;
    // Read new Transacoes
    const allNewTransacao = await this.transacaoService.findAllNewTransacao();

    // Retry all failed ItemTransacao to first new Transacao
    if (allNewTransacao.length > 0) {
      await this.itemTransacaoService.moveAllFailedToTransacao(
        allNewTransacao[0],
      );
    } else {
      this.logger.log(
        'Sem Transações novas para criar CNAB. Tarefa finalizada.',
        METHOD,
      );
      return;
    }

    const cnabs: CnabRemessaDTO[] = [];

    // Generate Remessas and send SFTP
    for (const transacao of allNewTransacao) {
      const cnab = await this.remessaRetornoService.generateCnabRemessa(
        transacao,
      );
      if (!cnab) {
        this.logger.warn(
          `A Transação #${transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`,
          METHOD,
        );
        continue;
      }
      try {
        await this.sftpService.submitCnabRemessa(cnab.string);
        cnabs.push(cnab.dto);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar o CNAB, tentaremos enviar no próximo job...`,
          METHOD,
          error,
        );
      }
    }

    // Save sent Remessas
    await this.remessaRetornoService.saveManyRemessa(cnabs);
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
    const { cnabString, cnabName } = {
      cnabName: 'smtr_prefeiturarj_140324_120102.ret',
      cnabString: `
10400000         20054603700011044477301P    0000   0406490006000710848 CONTA BILHETAGEM  CB          CAIXA                                   12604202415342300001008001600                                                      000  00        
10400011C2041041 20054603700011044477301000101      0406490006000710848 CONTA BILHETAGEM  CB                                                  R DONA MARIANA                00048ANDAR 7        RIO DE JANEIRO      22280020RJ                  
1040001300001A00001803302271 0000130987857 CONCESSIONARIA DO VLT CARIOCA 000001             126042024BRL000000000000000000000000090962000000000   01N1000000000000000000000000000                                        00          000        
1040001300002B   218201378000119                              00000                                                  00000     26042024000000000000000000000000000000000000000000000000000000000000000000000000000                              
10400015         000004000000000000090962000000000000000000000000                                                                                                                                                                               
10499999         000001000006000000                                                                                                                                                                                                             
`,
    };
    // await this.sftpService.getFirstCnabRetorno();
    if (!cnabName || !cnabString) {
      this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
      return;
    }

    // Save Retorno, ArquivoPublicacao, move SFTP to backup
    try {
      const retorno104 = parseCnab240Pagamento(cnabString);
      await this.remessaRetornoService.saveRetorno(retorno104);
      await this.arqPublicacaoService.compareRemessaToRetorno();
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
