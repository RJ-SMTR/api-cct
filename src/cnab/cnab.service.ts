import { Injectable } from '@nestjs/common';
import { format, nextFriday, startOfDay } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { asNumber } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
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
import { CnabRemessaDTO } from './interfaces/cnab-all/cnab-remsesa.interface';
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
import { parseCnab240Extrato } from './utils/cnab/cnab-104-utils';

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
    private transacaoAgService: TransacaoAgrupadoService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
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

  /**
   * Salvar transacoes e agrupados
   */
  async saveOrdens(ordens: BigqueryOrdemPagamentoDTO[]) {
    // 3. Save Transacao / ItemTransacao
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
    for (const ordem of ordens) {
      console.log('ORD => ' + JSON.stringify(ordem));
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

      const transacaoAgId = await this.saveAgrupamentos(
        ordem,
        pagador,
        favorecido,
      );

      const { item: transacao } = await this.saveTransacaoIfNotExists(
        ordem,
        pagador,
        transacaoAgId,
      );
      await this.saveItemTransacao(ordem, favorecido, transacao);
    }
  }

  getOrdemAgs(_ordens: BigqueryOrdemPagamentoDTO[]) {
    const ordens = structuredClone(_ordens);
    const newDataOrdemStr = format(nextFriday(new Date()), 'yyyy-MM-dd');
    let ordemTransacaoAgs = ordens.map((i) => ({
      ...i,
      dataOrdem: newDataOrdemStr,
    }));
    ordemTransacaoAgs = ordemTransacaoAgs.reduce(
      (g: BigqueryOrdemPagamentoDTO[], i) => {
        const existingAg = BigqueryOrdemPagamentoDTO.findAgrupado(g, i);
        if (!existingAg) {
          return [
            ...g,
            { ...i, dataOrdem: newDataOrdemStr } as BigqueryOrdemPagamentoDTO,
          ];
        } else {
          return [
            ...g,
            {
              ...i,
              valorTotalTransacaoLiquido:
                existingAg.valorTotalTransacaoLiquido +
                i.valorTotalTransacaoLiquido,
              dataOrdem: newDataOrdemStr,
            } as BigqueryOrdemPagamentoDTO,
          ];
        }
      },
      [],
    );
    return ordemTransacaoAgs;
  }

  async saveAgrupamentos(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    favorecido: ClienteFavorecido,
  ) {
    // 1. Verificar se as colunas de agrupamento existem nas tabelas agrupadas
    let transacaoAg = await this.transacaoAgService.findOne({
      dataOrdem: nextFriday(startOfDay(new Date())),
      pagador: { id: pagador.id },
    });

    // Se existe TransacaoAgrupado
    if (transacaoAg) {
      // Create or update item
      let itemAg = await this.itemTransacaoAgService.findOne({
        where: {
          transacaoAgrupado: { id: transacaoAg.id },
          idConsorcio: ordem.idConsorcio, // business rule
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
      const itemAg = this.getItemTransacaoAgrupadoDTO(
        ordem,
        favorecido,
        transacaoAg,
      );
      await this.itemTransacaoAgService.save(itemAg);
    }
    return transacaoAg.id;
  }

  async saveTransacaoIfNotExists(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    transacaoAgId: number,
  ): Promise<SaveIfNotExists<Transacao>> {
    const existing = await this.transacaoService.findOne({
      idOrdemPagamento: ordem.idOrdemPagamento,
    });
    if (existing) {
      return {
        isNewItem: false,
        item: existing,
      };
    }
    const transacao = new Transacao({
      dataOrdem: ordem.dataOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      status: new TransacaoStatus(TransacaoStatusEnum.created),
      transacaoAgrupado: { id: transacaoAgId },
    });
    return {
      isNewItem: true,
      item: await this.transacaoService.save(transacao),
    };
  }

  async saveTransacao(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    transacaoAgId: number,
  ) {
    const transacao = new Transacao({
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
    const transacao = new TransacaoAgrupado({
      dataOrdem: nextFriday(startOfDay(new Date())),
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
    const item = new ItemTransacaoAgrupado({
      clienteFavorecido: favorecido,
      dataCaptura: ordem.dataOrdem,
      dataOrdem: ordem.dataOrdem,
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

  async saveItemTransacao(
    ordem: BigqueryOrdemPagamentoDTO,
    favorecido: ClienteFavorecido,
    transacao: Transacao,
  ) {
    const item = new ItemTransacao({
      clienteFavorecido: favorecido,
      dataCaptura: ordem.dataOrdem,
      dataOrdem: ordem.dataOrdem,
      idConsorcio: ordem.idConsorcio,
      idOperadora: ordem.idOperadora,
      idOrdemPagamento: ordem.idOrdemPagamento,
      nomeConsorcio: ordem.consorcio,
      nomeOperadora: ordem.operadora,
      valor: ordem.valorTotalTransacaoLiquido,
      transacao: transacao,
      status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
    });
    await this.itemTransacaoService.save(item);
  }

  /**
   * @returns Only new ArquivoPublicacoes. Those associated with new Transacao.
   */
  // private updateNewPublicacaoDTOs(
  //   publicacoes: ArquivoPublicacao[],
  //   createdTransacoes: Transacao[],
  // ): ArquivoPublicacao[] {
  //   /** key: idOrdemPagamento */
  //   const transacaoMap: Record<string, Transacao> = createdTransacoes.reduce(
  //     (map, i) => ({ ...map, [asString(i.idOrdemPagamento)]: i }),
  //     {},
  //   );
  //   const newPublicacoes: ArquivoPublicacao[] = [];
  //   for (const publicacao of publicacoes) {
  //     const transacao = transacaoMap[publicacao.idOrdemPagamento];
  //     if (transacao) {
  //       publicacao.itemTransacao = { id: transacao.id } as Transacao;
  //       newPublicacoes.push(publicacao);
  //     }
  //   }
  //   this.logger.debug(
  //     `${newPublicacoes.length}/${publicacoes.length} ArquivoPublicacoes novas ` +
  //       '(associado com Transacao nova).',
  //   );
  //   return newPublicacoes;
  // }

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
      transacoes = await this.transacaoService.findAllNewTransacao();
    } else {
      const transacoesAg = await this.transacaoAgService.findAllNewTransacao();
      transacoes = transacoesAg as unknown as Transacao[];
    }

    if (!transacoes.length) {
      this.logger.log(
        `Não há transações novas para gerar remessa, nada a fazer...`,
        METHOD,
      );
      return;
    }

    const cnabs: CnabRemessaDTO[] = [];

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
      const cnab = await this.remessaRetornoService.generateCnabRemessa(
        transacao,
        transacaoAg,
      );
      if (!cnab) {
        this.logger.warn(
          `A Transação/Agrupado #${_transacao.id} gerou cnab vazio (sem itens válidos), ignorando...`,
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
    await this.remessaRetornoService.saveManyRemessa(
      cnabs,
      tipo === PagadorContaEnum.ContaBilhetagem,
    );
  }

  /**
   * This task will:
   * 1. Get first retorno from SFTP
   * 2. Save retorno to CNAB tables
   * 3.  - If successfull, move retorno to backup folder.
   *     - If failed, move retorno to backup/failure folder
   */
//     public async updateRetorno() {
//       const METHOD = this.updateRetorno.name;
//       // Get retorno
//       const { cnabString, cnabName } = {
//         cnabName: 'smtr_prefeiturarj_140324_120102.ret',
//         cnabString: `
// 10400000         20054603700011044477301P    0000   0406490006000710848 CONTA BILHETAGEM  CB          CAIXA                                   10305202412573500051608001600                                                      000            
// 10400011C2041041 20054603700011044477301000101      0406490006000710848 CONTA BILHETAGEM  CB                                                  R DONA MARIANA                00048ANDAR 7        RIO DE JANEIRO      22280020RJ                  
// 1040001300001A000018001022349000000296001X COMPANHIA MUNICIPAL DE TRANSPO000001             103052024BRL000000000000000000000006969170000000000   01N1000000000000000000000000000                                        00          0          
// 1040001300002B   244520687000161                              00000                                                  00000     03052024000000000000000000000000000000000000000000000000000000000000000000000000000                              
// 1040001300003A00001803303403 0000130044428 CONSORCIO SANTA CRUZ TRANSPORT000002             103052024BRL000000000000000000000000045975000000000   01N1000000000000000000000000000                                        00          0          
// 1040001300004B   212464577000133                              00000                                                  00000     03052024000000000000000000000000000000000000000000000000000000000000000000000000000                              
// 1040001300005A00001803303403 0000130044459 CONSORCIO INTERNORTE DE TRANSP000003             103052024BRL000000000000000000000000034705000000000   01N1000000000000000000000000000                                        00          0          
// 1040001300006B   212464539000180                              00000                                                  00000     03052024000000000000000000000000000000000000000000000000000000000000000000000000000                              
// 1040001300007A00001803302271 0000130987857 CONCESSIONARIA DO VLT CARIOCA 000004             103052024BRL000000000000000000000000775082000000000   01N1000000000000000000000000000                                        00          0          
// 1040001300008B   218201378000119                              00000                                                  00000     03052024000000000000000000000000000000000000000000000000000000000000000000000000000                              
// 10400015         000010000000000007824932000000000000000000000000                                                                                                                                                                               
// 10499999         000001000012000000                                                                                                                                                                                                             
// `,
//       };
//       // await this.sftpService.getFirstCnabRetorno();
//       if (!cnabName || !cnabString) {
//         this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
//         return;
//       }

//       // Save Retorno, ArquivoPublicacao, move SFTP to backup
//       try {
//         const retorno104 = parseCnab240Pagamento(cnabString);
//         await this.remessaRetornoService.saveRetorno(retorno104);
//         await this.arqPublicacaoService.compareRemessaToRetorno();
//         await this.sftpService.moveToBackup(
//           cnabName,
//           SftpBackupFolder.RetornoSuccess,
//         );
//       } catch (error) {
//         this.logger.error(
//           `Erro ao processar CNAB retorno, movendo para backup de erros e finalizando... - ${error}`,
//           error.stack,
//           METHOD,
//         );
//         await this.sftpService.moveToBackup(
//           cnabName,
//           SftpBackupFolder.RetornoFailure,
//         );
//         return;
//       }
//     }

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
