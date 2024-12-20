import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
// import { LancamentoStatus } from 'src/lancamento/enums/lancamento-status.enum';
import { SettingsService } from 'src/settings/settings.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { IClearSyncOrdemPgto, ISyncOrdemPgto } from 'src/transacao-view/interfaces/sync-transacao-ordem.interface';
import { TransacaoView } from 'src/transacao-view/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-view/transacao-view.service';
import { UsersService } from 'src/users/users.service';
import { getChunks } from 'src/utils/array-utils';
import { completeCPFCharacter } from 'src/utils/cpf-cnpj';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateInterval } from 'src/utils/date-utils';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { formatErrMsg } from 'src/utils/log-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { isContent } from 'src/utils/type-utils';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, In, QueryRunner } from 'typeorm';
import { CnabHeaderArquivo104 } from './dto/cnab-240/104/cnab-header-arquivo-104.dto';
import { HeaderArquivoDTO } from './dto/pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from './dto/pagamento/header-lote.dto';
import { OrdemPagamentoDto } from './dto/pagamento/ordem-pagamento.dto';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { DetalheB } from './entity/pagamento/detalhe-b.entity';
import { HeaderArquivo } from './entity/pagamento/header-arquivo.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from './entity/pagamento/transacao-status.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { Cnab104AmbienteCliente } from './enums/104/cnab-104-ambiente-cliente.enum';
import { Cnab104FormaLancamento } from './enums/104/cnab-104-forma-lancamento.enum';
import { HeaderArquivoStatus } from './enums/pagamento/header-arquivo-status.enum';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { TransacaoStatusEnum } from './enums/pagamento/transacao-status.enum';
import { CnabFile104Extrato } from './interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabFile104PgtoDTO } from './interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { CnabRegistros104Pgto } from './interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { AllPagadorDict } from './interfaces/pagamento/all-pagador-dict.interface';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { DetalheBService } from './service/pagamento/detalhe-b.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { ItemTransacaoAgrupadoService } from './service/pagamento/item-transacao-agrupado.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoAgrupadoService } from './service/pagamento/transacao-agrupado.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import { parseCnab240Extrato, parseCnab240Pagamento, stringifyCnab104File } from './utils/cnab/cnab-104-utils';
import { OrdemPagamentoService } from './novo-remessa/service/ordem-pagamento.service';

export interface ICnabInfo {
  name: string;
  content: string;
  headerArquivo: HeaderArquivoDTO;
}

interface IFindRemessaArgs {
  headerArquivoIds?: number[];
  status?: HeaderArquivoStatus;
}

/**
 * User cases for CNAB and Payments
 */
@Injectable()
export class CnabService {
  private logger = new CustomLogger(CnabService.name, { timestamp: true });

  constructor(
    private arquivoPublicacaoService: ArquivoPublicacaoService, //
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private bigqueryTransacaoService: BigqueryTransacaoService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private extDetalheEService: ExtratoDetalheEService,
    private extHeaderArquivoService: ExtratoHeaderArquivoService,
    private extHeaderLoteService: ExtratoHeaderLoteService,
    private headerArquivoService: HeaderArquivoService,
    private headerArquivoConfService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    // private lancamentoService: LancamentoService,
    private pagadorService: PagadorService,
    private remessaRetornoService: RemessaRetornoService,
    private sftpService: SftpService,
    private transacaoAgService: TransacaoAgrupadoService,
    private transacaoService: TransacaoService,
    private transacaoViewService: TransacaoViewService,
    private usersService: UsersService,
    @InjectDataSource()
    private dataSource: DataSource,
    private settingsService: SettingsService,
    private ordemPagamentoService: OrdemPagamentoService,
  ) {}

  async findSendRemessas(args?: IFindRemessaArgs) {
    const METHOD = 'getSendRemessa';
    const startDate = new Date();
    this.logger.log('Tarefa iniciada', METHOD);
    const remessas = await this.findRemessas(args);
    if (!remessas.length) {
      const duration = formatDateInterval(new Date(), startDate);
      this.logger.log(`Não há remessas para enviar. - ${duration}`);
      return { duration, cnabs: [] };
    }
    await this.sendRemessa(remessas);
    const duration = formatDateInterval(new Date(), startDate);
    this.logger.log(`Tarefa finalizada - ${duration}`);
    return { duration, remessas };
  }

  async findRemessas(args?: IFindRemessaArgs): Promise<ICnabInfo[]> {
    const listCnab: ICnabInfo[] = [];
    if (!args) {
      this.logger.warn('Por segurança é preciso definir parâmetros para buscar por remessas. Retornando vazio..');
      return listCnab;
    }
    const headerArquivos = await this.headerArquivoService.findMany({
      ...(args?.headerArquivoIds?.length ? { id: In(args.headerArquivoIds) } : {}),
      ...(args?.status ? { status: args.status } : {}),
    });

    if (!headerArquivos.length) {
      this.logger.log('Não foram encontrados remessas');
    }
    for (const headerArquivo of headerArquivos) {
      const isTeste = headerArquivo.ambienteCliente === Cnab104AmbienteCliente.Teste;
      const headerArquivoDTO = HeaderArquivoDTO.fromEntity(headerArquivo, false);
      const headerLotes = await this.headerLoteService.findMany({ headerArquivo: { id: headerArquivo.id } });
      const detalheAs = await this.detalheAService.findManyRaw({ headerLote: { id: headerLotes.map((hl) => hl.id) } });
      const detalheBs = await this.detalheBService.findMany({ where: { detalheA: { id: In(detalheAs.map((da) => da.id)) } }, relations: ['detalheA'] as (keyof DetalheB)[] });
      const itemTransacoes = await this.itemTransacaoService.findMany({ where: { itemTransacaoAgrupado: { id: In(detalheAs.map((da) => da.itemTransacaoAgrupado.id)) } }, order: { id: 'ASC' } });
      const headerLoteDTOs = HeaderLoteDTO.fromEntities(headerLotes, detalheAs, detalheBs, itemTransacoes, isTeste);
      const cnab104 = CnabFile104PgtoDTO.fromDTO({ headerArquivoDTO, headerLoteDTOs, isCancelamento: true, isTeste });
      if (headerArquivo && cnab104) {
        const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
        if (!cnabStr) {
          this.logger.warn(`Não foi gerado um cnabString - headerArqId: ${headerArquivo.id}`);
          continue;
        }
        listCnab.push({ name: '', content: cnabStr, headerArquivo: headerArquivoDTO });
      }
    }
    return listCnab;
  }

  async generateRemessaJae(args: {
    dataOrdemInicial: Date; //
    dataOrdemFinal: Date;
    diasAnteriores: number;
    consorcio: string;
    dataPgto: Date | undefined;
    isConference: boolean;
    isCancelamento: boolean;
    isTeste: boolean;
    nsaInicial: number | undefined;
    nsaFinal: number | undefined;
    dataCancelamento: Date | undefined;
  }) {
    const METHOD = 'getGenerateRemessaJae';
    const { consorcio, dataCancelamento, dataOrdemFinal, dataOrdemInicial, dataPgto, diasAnteriores, isCancelamento, isConference, nsaFinal, nsaInicial, isTeste } = args;
    const duration = { saveTransacoesJae: '', generateRemessa: '', sendRemessa: '', total: '' };
    const startDate = new Date();
    let now = new Date();
    this.logger.log('Tarefa iniciada', METHOD);

    await this.saveTransacoesJae(dataOrdemInicial, dataOrdemFinal, diasAnteriores, consorcio);
    duration.saveTransacoesJae = formatDateInterval(new Date(), now);
    now = new Date();

    const listCnab = await this.generateRemessa({
      tipo: PagadorContaEnum.ContaBilhetagem,
      dataPgto,
      isConference,
      isCancelamento,
      isTeste,
      nsaInicial,
      nsaFinal,
      dataCancelamento,
    });

    duration.generateRemessa = formatDateInterval(new Date(), now);
    now = new Date();

    await this.sendRemessa(listCnab);
    duration.sendRemessa = formatDateInterval(new Date(), now);

    duration.total = formatDateInterval(new Date(), startDate);
    this.logger.log(`Tarefa finalizada - ${duration.total}`);
    return {
      duration,
      listCnab,
    };
  }

  // async generateRemessaLancamento(args: {
  //   dataOrdemInicial?: Date; //
  //   dataOrdemFinal?: Date;
  //   dataPgto: Date | undefined;
  //   isConference: boolean;
  //   isCancelamento: boolean;
  //   isTeste: boolean;
  //   nsaInicial: number | undefined;
  //   nsaFinal: number | undefined;
  //   dataCancelamento: Date | undefined;
  // }) {
  //   const METHOD = 'getGenerateRemessaLancamento';
  //   const { dataCancelamento, dataOrdemFinal, dataOrdemInicial, dataPgto, isCancelamento, isConference, isTeste, nsaFinal, nsaInicial } = args;
  //   const duration = { saveTransacoesJae: '', generateRemessa: '', sendRemessa: '', total: '' };
  //   const startDate = new Date();
  //   let now = new Date();
  //   this.logger.log('Tarefa iniciada', METHOD);

  //   await this.saveTransacoesLancamento(dataOrdemInicial, dataOrdemFinal);
  //   duration.saveTransacoesJae = formatDateInterval(new Date(), now);
  //   now = new Date();

  //   const listCnab = await this.generateRemessa({
  //     tipo: PagadorContaEnum.CETT, //
  //     dataPgto,
  //     isConference,
  //     isCancelamento,
  //     isTeste,
  //     nsaInicial,
  //     nsaFinal,
  //     dataCancelamento,
  //   });
  //   duration.generateRemessa = formatDateInterval(new Date(), now);
  //   now = new Date();

  //   await this.sendRemessa(listCnab);
  //   duration.sendRemessa = formatDateInterval(new Date(), now);

  //   duration.total = formatDateInterval(new Date(), startDate);
  //   this.logger.log(`Tarefa finalizada - ${duration.total}`);
  //   return {
  //     duration,
  //     cnabs: listCnab,
  //   };
  // }

  public async sendRemessa(listCnab: ICnabInfo[]) {
    for (const cnab of listCnab) {
      cnab.name = await this.sftpService.submitCnabRemessa(cnab.content);
      const remessaName = ((l = cnab.name.split('/')) => l.slice(l.length - 1)[0])();
      if (cnab.headerArquivo._isConf) {
        await this.headerArquivoConfService.save({ id: cnab.headerArquivo.id, remessaName, status: HeaderArquivoStatus._3_remessaEnviado });
      } else {
        await this.headerArquivoService.save({ id: cnab.headerArquivo.id, remessaName, status: HeaderArquivoStatus._3_remessaEnviado });
      }
    }
  }

  /**
   * Atualiza valores nulos com o Bigquery
   */
  async updateTransacaoViewBigqueryValues(diasAnteriores?: number, idOperadora?: string[]) {
    const METHOD = 'updateTransacaoViewBigqueryValues';
    const startDate = new Date();
    const result = { updated: 0, duration: '00:00:00' };
    this.logger.log(`Tarefa iniciada`, METHOD);
    const chunkSize = 2000;

    let allTransacoesView: any[] = await this.transacaoViewService.findUpdateValues({ diasAnteriores, idOperadora });
    const max = allTransacoesView.length;
    allTransacoesView = getChunks(allTransacoesView, chunkSize);
    for (const transacoesView of allTransacoesView as TransacaoView[][]) {
      const tvIds = transacoesView.map((i) => i.idTransacao);
      const transacaoBq = await this.bigqueryTransacaoService.findMany({ id_transacao: tvIds, valor_pagamento: 'NOT NULL', id_operadora: idOperadora });

      const updateDtos = transacoesView
        .filter((tv) => ((bq = transacaoBq.find((bq1) => bq1.id_transacao == tv.idTransacao)) => bq && (bq.valor_pagamento != tv.valorPago || bq.tipo_transacao != tv.tipoTransacao))())
        .map((tv) =>
          ((bq = transacaoBq.filter((bq1) => bq1.id_transacao == tv.idTransacao)[0]) =>
            ({
              id: tv.id,
              idTransacao: tv.idTransacao,
              valorPago: bq.valor_pagamento || (isContent(tv.valorPago) ? tv.valorPago : null),
              tipoTransacao: bq.tipo_transacao,
            } as DeepPartial<TransacaoView>))(),
        );
      await this.transacaoViewService.updateManyRaw(updateDtos, ['valorPago', 'tipoTransacao'], 'idTransacao');

      result.updated += transacoesView.length;
      result.duration = formatDateInterval(new Date(), startDate);
      const percent = ((result.updated / max) * 100).toFixed(2).padStart(5, '0');
      const index = (result.updated / 1000).toFixed(2);
      const maxIndex = (max / 1000).toFixed(2);
      this.logger.log(`Atualizado ${percent}%, ${index}/${maxIndex}K itens - ${result.duration}`, METHOD);
    }

    this.logger.log(`Tarefa finalizada - ${result.duration}`, METHOD);
    return result;
  }

  async deduplicateTransacaoView() {
    const startDate = new Date();
    const removed = await this.transacaoViewService.removeDuplicates();
    const duration = formatDateInterval(new Date(), startDate);
    return { removed, duration };
  }

  /**
   * Obtém dados de OrdemPagamento e salva em ItemTransacao e afins, para gerar remessa.
   *
   * As datas de uma semana de pagamento são de sex-qui (D+1)
   *
   * Requirement: **Salvar novas transações Jaé** - {@link https://github.com/RJ-SMTR/api-cct/issues/207#issuecomment-1984421700 #207, items 3}
   */
  public async saveTransacoesJae(dataCapturaInicial: Date, dataCapturaFinal: Date, daysBefore = 0, consorcio: 'VLT' | 'Van' | 'Empresa' | 'Todos' | string) {
    const dataCapturaInicialDate = startOfDay(new Date(dataCapturaInicial));
    const dataCapturaFinalDate = endOfDay(new Date(dataCapturaFinal));
    await this.updateAllFavorecidosFromUsers();
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, daysBefore);
    let ordensFilter: BigqueryOrdemPagamentoDTO[];
    if (consorcio.trim() === 'Empresa') {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() !== 'VLT' && ordem.consorcio.trim() !== 'STPC' && ordem.consorcio.trim() !== 'STPL' && ordem.consorcio.trim() !== 'TEC');
    } else if (consorcio.trim() === 'Van') {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() === 'STPC' || ordem.consorcio.trim() === 'STPL' || ordem.consorcio.trim() === 'TEC');
    } else {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio === consorcio.trim());
    }
    const ordemDtos = ordensFilter.map((o) => OrdemPagamentoDto.fromBigqueryOrdem(o));
    await this.saveOrdens(ordemDtos, 'contaBilhetagem');
  }

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findManyRegisteredUsers();
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  /**
   * Atualiza a tabela TransacaoView com dados novos ou atualizados do bigquery
   */
  async updateTransacaoViewBigquery(dataOrdemIncial: Date, dataOrdemFinal: Date, daysBack = 0, consorcio: string = 'Todos', idTransacao: string[] = []) {
    const METHOD = 'updateTransacaoViewBigquery';
    const trs = await this.findBigqueryTransacao(dataOrdemIncial, dataOrdemFinal, daysBack, consorcio);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const response = await this.updateTransacaoViewBigqueryLimit(trs, queryRunner, idTransacao);
      this.logger.log(`TransacaoView atualizado: ${JSON.stringify(response)}`, METHOD);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Falha ao salvar TransacaoView`, error?.stack, METHOD);
    } finally {
      await queryRunner.release();
    }
  }

  async updateTransacaoViewBigqueryLimit(trsBq: BigqueryTransacao[], queryRunner: QueryRunner, idTransacao: string[] = []) {
    const trsFilter = idTransacao.length ? trsBq.filter((i) => idTransacao.includes(i.id_transacao)) : trsBq;
    const existings = await this.transacaoViewService.findRaw({ where: { idTransacao: trsFilter.map((tv) => tv.id_transacao) } });
    const response = { updated: 0, created: 0, deduplicated: 0 };
    for (const trBq of trsFilter) {
      const transacaoViewBq = TransacaoView.fromBigqueryTransacao(trBq);
      if (transacaoViewBq.modo && transacaoViewBq.nomeOperadora) {
        const existing = existings.filter((ex) => ex.idTransacao == transacaoViewBq.idTransacao);
        if (existing.length === 0) {
          await queryRunner.manager.getRepository(TransacaoView).save(transacaoViewBq);
          response.created += 1;
        } else {
          if (existing.length > 1) {
            await queryRunner.manager.getRepository(TransacaoView).remove(existing.slice(1));
            response.deduplicated += 1;
          }

          if (!existing[0].valorPago && transacaoViewBq.valorPago != existing[0].valorPago) {
            response.updated += 1;
            await this.transacaoViewService.updateManyRaw(
              [{ id: existing[0].id, idTransacao: existing[0].idTransacao, valorPago: transacaoViewBq.valorPago }], //
              ['idTransacao', 'valorPago'],
              'idTransacao',
              queryRunner.manager,
            );
          }
        }
      }
    }
    return response;
  }

  async findBigqueryTransacao(dataOrdemIncial: Date, dataOrdemFinal: Date, daysBack = 0, consorcio: string): Promise<BigqueryTransacao[]> {
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek(startOfDay(dataOrdemIncial), endOfDay(dataOrdemFinal), daysBack);
    let trs = transacoesBq;
    if (consorcio === 'Van') {
      trs = transacoesBq.filter((tr) => tr.consorcio === 'STPC' || tr.consorcio === 'STPL');
    } else if (consorcio == 'Empresa') {
      trs = transacoesBq.filter((tr) => tr.consorcio !== 'STPC' && tr.consorcio !== 'STPL');
    }
    return trs;
  }

  // #region saveOrdens

  async saveOrdens(ordens: OrdemPagamentoDto[], pagadorKey: keyof AllPagadorDict) {
    if (!ordens.length) {
      return;
    }
    const pagador = (await this.pagadorService.getAllPagador())[pagadorKey];

    for (const ordem of ordens) {
      const cpfCnpj = ordem.favorecidoCpfCnpj;
      if (!cpfCnpj) {
        continue;
      }
      const favorecido = await this.clienteFavorecidoService.findOne({
        where: { cpfCnpj: completeCPFCharacter(cpfCnpj, 0) },
      });
      if (!favorecido) {
        continue;
      }
      await this.saveAgrupamentos(ordem, pagador, favorecido);
    }
  }

  /**
   * A partir da Ordem, salva nas tabelas Transacao, ItemTransacao etc
   */
  async saveAgrupamentos(ordem: OrdemPagamentoDto, pagador: Pagador, favorecido: ClienteFavorecido) {
    const METHOD = 'saveAgrupamentos';
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let transacaoAg: Nullable<TransacaoAgrupado> = null;
    try {
      await queryRunner.startTransaction();
      this.logger.debug(`Salvando Agrupamento - ${JSON.stringify({ consorcio: ordem.consorcio, operadora: favorecido.nome, favorecidoCpfCnpj: ordem.favorecidoCpfCnpj })}`, METHOD);
      transacaoAg = await this.transacaoAgService.findOne({
        dataOrdem: ordem.getTransacaoAgrupadoDataOrdem(),
        pagador: { id: pagador.id },
        status: { id: TransacaoStatusEnum.created },
      });

      let itemAg: ItemTransacaoAgrupado | null = null;
      if (transacaoAg) {
        itemAg = await this.saveUpdateItemTransacaoAgrupado(transacaoAg, ordem, queryRunner);
      } else {
        transacaoAg = await this.saveTransacaoAgrupado(ordem, pagador);
        itemAg = await this.saveItemTransacaoAgrupado(ordem, transacaoAg, queryRunner);
      }
      const transacao = await this.saveTransacao(ordem, pagador, transacaoAg.id, queryRunner);
      await this.saveItemTransacaoPublicacao(ordem, favorecido, transacao, itemAg, queryRunner);
      await queryRunner.commitTransaction();
      this.logger.debug('Fim Agrupamento Consorcio: ' + ordem.consorcio);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (transacaoAg !== null) {
        transacaoAg.status.id = TransacaoStatusEnum.cancelado;
        await this.transacaoAgService.save(transacaoAg);
      }
      this.logger.error(`Falha ao salvar Informações agrupadas`, error?.stack);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rergra de negócio:
   * - Usa idConsorcio, idOperadora, consorcio para agrupar um itemAgrupado
   */
  private async saveUpdateItemTransacaoAgrupado(transacaoAg: TransacaoAgrupado, ordem: OrdemPagamentoDto, queryRunner: QueryRunner): Promise<ItemTransacaoAgrupado> {
    if (!ordem.consorcio.length && !ordem.operadora.length && !ordem.favorecidoCpfCnpj) {
      throw new Error(`Não implementado - Criar/atualizar ItemAgrupado necessita de consorcio/operadora ou favorecidoCpfCnpj`);
    }

    let itemAg = await this.itemTransacaoAgService.findOne({
      where: {
        transacaoAgrupado: {
          id: transacaoAg.id,
          status: { id: TransacaoStatusEnum.created },
        },
        ...(ordem.consorcio.length || ordem.operadora.length
          ? // Se for Jaé, agrupa por vanzeiro ou empresa
            ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL' || ordem.consorcio === 'TEC'
            ? { idOperadora: ordem.idOperadora }
            : { idConsorcio: ordem.idConsorcio }
          : // Se for Lançamento, agrupa por favorecido e dataOrdem
            {
              itemTransacoes: { clienteFavorecido: { cpfCnpj: ordem.favorecidoCpfCnpj as string } }, //
              dataOrdem: startOfDay(new Date(ordem.dataOrdem)),
            }),
      },
    });
    if (itemAg) {
      itemAg.valor += asNumber(ordem.valorTotalTransacaoLiquido);
    } else {
      itemAg = ItemTransacaoAgrupado.fromOrdem(ordem, transacaoAg);
    }
    return await this.itemTransacaoAgService.save(itemAg, queryRunner);
  }

  async syncTransacaoViewOrdemPgto(args?: ISyncOrdemPgto) {
    this.logger.debug('Inicio Sync TransacaoView');
    const startDate = new Date();
    let count = await this.transacaoViewService.syncOrdemPgto(args);
    const endDate = new Date();
    const duration = formatDateInterval(endDate, startDate);
    this.logger.debug(`Fim Sync TransacaoView - duração: ${duration}`);
    return { duration, count };
  }

  private async saveTransacaoAgrupado(ordem: OrdemPagamentoDto, pagador: Pagador) {
    const transacaoAg = TransacaoAgrupado.fromOrdem(ordem, pagador);
    return await this.transacaoAgService.save(transacaoAg);
  }

  private async saveItemTransacaoAgrupado(ordem: OrdemPagamentoDto, transacaoAg: TransacaoAgrupado, queryRunner: QueryRunner) {
    const itemAg = ItemTransacaoAgrupado.fromOrdem(ordem, transacaoAg);
    return await this.itemTransacaoAgService.save(itemAg, queryRunner);
  }

  /**
   * A partir do OrdemBigquery salva Transacao
   *
   * Chave primária: TransacaoAgrupado, idOrdemBq, pagador
   */
  async saveTransacao(ordem: OrdemPagamentoDto, pagador: Pagador, transacaoAgId: number, queryRunner: QueryRunner): Promise<Transacao> {
    const transacao = Transacao.fromOrdem(ordem, pagador, transacaoAgId);
    return await this.transacaoService.save(transacao, queryRunner);
  }

  async saveItemTransacaoPublicacao(ordem: OrdemPagamentoDto, favorecido: ClienteFavorecido, transacao: Transacao, itemTransacaoAg: ItemTransacaoAgrupado, queryRunner: QueryRunner) {
    const item = ItemTransacao.fromOrdem(ordem, favorecido, transacao, itemTransacaoAg);
    await this.itemTransacaoService.save(item, queryRunner);
    if (!ordem.lancamento) {
      const publicacao = await this.arquivoPublicacaoService.convertPublicacaoDTO(item);
      await this.arquivoPublicacaoService.save(publicacao, queryRunner);
    }
  }

  // #endregion

  // public async saveTransacoesLancamento(dataOrdemInicial?: Date, dataOrdemFinal?: Date) {
  //   const dataOrdem: [Date, Date] | undefined = dataOrdemInicial && dataOrdemFinal ? [startOfDay(dataOrdemInicial), endOfDay(dataOrdemFinal)] : undefined;
  //   await this.updateAllFavorecidosFromUsers();
  //   const newLancamentos = await this.lancamentoService.findToPay(dataOrdem);
  //   const ordensCett = newLancamentos.cett.map((l) => OrdemPagamentoDto.fromLancamento(l));
  //   await this.saveOrdens(ordensCett, 'cett');
  //   const ordensCb = newLancamentos.contaBilhetagem.map((l) => OrdemPagamentoDto.fromLancamento(l));
  //   await this.saveOrdens(ordensCb, 'contaBilhetagem');
  // }

  public async generateRemessa(args: { tipo: PagadorContaEnum; dataPgto?: Date; isConference: boolean; isCancelamento: boolean; isTeste: boolean; nsaInicial?: number; nsaFinal?: number; dataCancelamento?: Date }): Promise<ICnabInfo[]> {
    const currentNSA = await this.settingsService.getCurrentNSA(args.isTeste);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const listCnab: ICnabInfo[] = [];
    try {
      await queryRunner.startTransaction();
      if (args.isCancelamento) {
        await this.geraRemssaCancelamento(args, listCnab, currentNSA);
      } else {
        await this.gerarRemessaPadrao(args, listCnab);
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Falha ao salvar Informções agrupadas`, error?.stack);
    } finally {
      await queryRunner.release();
    }
    if (!listCnab.length) {
      this.logger.warn('Gerado lista de remessas vazia.');
    } else {
      this.logger.warn(`Gerado lista com ${listCnab.length} remessas.`);
    }
    return listCnab;
  }

  private async gerarRemessaPadrao(args: any, listCnab: ICnabInfo[] = []) {
    const transacoesAg = await this.transacaoAgService.findAllNewTransacao(args.tipo);
    if (!transacoesAg.length) {
      this.logger.log(`Não há transações novas para gerar remessa, nada a fazer...`);
      return [];
    }
    for (const transacaoAg of transacoesAg) {
      const headerArquivoDTO = await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg, args.isConference, args.isTeste);
      const headerLoteDTOs = await this.remessaRetornoService.getLotes(transacaoAg.pagador, headerArquivoDTO, args.isConference, args.isTeste, args.dataPgto);
      const cnab104 = CnabFile104PgtoDTO.fromDTO({ headerArquivoDTO, headerLoteDTOs, isTeste: args.isTeste });
      if (headerArquivoDTO && cnab104) {
        const [cnabStr, processedCnab104] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
        for (const processedLote of processedCnab104.lotes) {
          const savedLote = headerLoteDTOs.filter((i) => i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
          await this.remessaRetornoService.updateHeaderLoteDTOFrom104(savedLote, processedLote.headerLote, args.isConference);
        }
        if (!args.isConference) {
          await this.updateStatusRemessa(headerArquivoDTO, processedCnab104.headerArquivo, transacaoAg.id);
        }
        if (cnabStr) {
          listCnab.push({ name: '', content: cnabStr, headerArquivo: headerArquivoDTO });
        }
      }
    }
  }

  private async geraRemssaCancelamento(args: any, listCnab: ICnabInfo[] = [], currentNSA) {
    let nsaInicial = args.nsaInicial || currentNSA;
    let nsaFinal = args.nsaFinal || nsaInicial;
    if (this.validateCancel(args.nsaInicial, args.nsaFinal)) {
      this.logger.warn('Cancelamento de validação detectado, não haverá remessas para enviar..');
      return [];
    }

    if (!listCnab.length && args.nsaInicial >= args.nsaFinal + 1) {
      this.logger.warn(`nsaInicial não é menor que  nsaFinal + 1, será gerada uma lista vazia (nsaInicial: ${args.nsaInicial}
        , nsaFinal: ${args.nsaFinal})`);
    }
    for (let nsa = args.nsaInicial; nsa < args.nsaFinal + 1; nsa++) {
      const headerArquivo = await this.getHeaderArquivoCancelar(nsa);
      const headerArquivoDTO = HeaderArquivoDTO.fromEntity(headerArquivo, false);
      headerArquivoDTO.nsa = await this.settingsService.getNextNSA(args.isTeste);
      const lotes = await this.getLotesCancelar(nsa);
      const headerLoteDTOs: HeaderLoteDTO[] = [];
      let detalhes: CnabRegistros104Pgto[] = [];
      for (const lote of lotes) {
        const headerLoteDTO = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivo, lote.pagador, lote.formaLancamento == '41' ? Cnab104FormaLancamento.TED : Cnab104FormaLancamento.CreditoContaCorrente, args.isTeste);
        const detalhesA = (await this.detalheAService.findMany({ headerLote: { id: lote.id } })).sort((a, b) => a.nsr - b.nsr);
        for (const detalheA of detalhesA) {
          const detalhe = await this.remessaRetornoService.saveDetalhes104(undefined, detalheA.numeroDocumentoEmpresa, headerLoteDTO, detalheA.itemTransacaoAgrupado, detalheA.nsr, false, detalheA.dataVencimento, true, detalheA);
          if (detalhe) {
            detalhes.push(detalhe);
          }
        }
        headerLoteDTO.registros104 = detalhes;
        headerLoteDTOs.push(headerLoteDTO);
        detalhes = [];
      }
      const cnab104 = CnabFile104PgtoDTO.fromDTO({ headerArquivoDTO: headerArquivo, headerLoteDTOs, isCancelamento: true, isTeste: args.isTeste });
      if (headerArquivo && cnab104) {
        const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
        if (!cnabStr) {
          this.logger.warn(`Não foi gerado cnabString - (headerArqId: ${headerArquivo.id})`);
          continue;
        }
        listCnab.push({ name: '', content: cnabStr, headerArquivo: HeaderArquivoDTO.fromEntity(headerArquivo, false) });
      }
    }
  }

  private async updateStatusRemessa(headerArquivoDTO: HeaderArquivoDTO, cnabHeaderArquivo: CnabHeaderArquivo104, transacaoAgId: number) {
    await this.remessaRetornoService.updateHeaderArquivoDTOFrom104(headerArquivoDTO, cnabHeaderArquivo);
    await this.transacaoAgService.save({ id: transacaoAgId, status: TransacaoStatus.fromEnum(TransacaoStatusEnum.remessa) });
    // await this.lancamentoService.update({ status: LancamentoStatus._4_remessa_enviado }, { transacaoAgrupado: { id: transacaoAgId } });
  }

  private validateCancel(nsaInicial: number, nsaFinal: number) {
    return (nsaInicial == undefined && nsaFinal == undefined) || (nsaFinal != 0 && nsaFinal < nsaInicial);
  }

  private async getLotesCancelar(nsa: number) {
    return (await this.headerLoteService.findMany({ headerArquivo: { nsa: nsa } })).sort((a, b) => a.loteServico - b.loteServico);
  }

  private async getHeaderArquivoCancelar(nsa: number): Promise<HeaderArquivo> {
    return await this.headerArquivoService.getOne({ nsa });
  }

  /**
   * Lê retorno da Jaé e Lançamento
   */
  public async readRetornoPagamento(folder?: string, maxItems?: number) {
    const METHOD = 'readRetornoPagamento';
    const INVALID_ORIGIN_FOLDERS = ['/backup/retorno/success', '/backup/retorno/failed'];
    if (folder && INVALID_ORIGIN_FOLDERS.includes(folder)) {
      throw CommonHttpException.message(`Não é possível ler retornos das pastas ${INVALID_ORIGIN_FOLDERS}`);
    }

    let cnab = await this.sftpService.getFirstRetornoPagamento(folder);
    const cnabs: string[] = [];
    const success: any[] = [];
    const failed: any[] = [];
    const startDate = new Date();
    while (cnab && (!maxItems || cnabs.length < maxItems)) {
      this.logger.log(`Leitura de retornos iniciada: ${cnab.name}`, METHOD);
      const startDateItem = new Date();
      cnabs.push(cnab.name);
      try {
        const retorno104 = parseCnab240Pagamento(cnab.content);
        await this.remessaRetornoService.saveRetornoPagamento(retorno104, cnab.name);
        await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess, cnab.content, folder);
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.log(`CNAB '${cnab.name}' lido com sucesso - ${durationItem}`);
        success.push(cnab.name);
      } catch (error) {
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.error(`Erro ao processar CNAB ${cnab.name}. Movendo para backup de erros e finalizando - ${durationItem} - ${formatErrMsg(error)}`, error.stack, METHOD);
        if (!cnab) {
          this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
          const duration = formatDateInterval(new Date(), startDate);
          return { duration, cnabs: cnabs.length, success, failed };
        }
        await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure, cnab.content, folder);
        failed.push(cnab.name);
      }
      cnab = await this.sftpService.getFirstRetornoPagamento(folder);
    }
    const duration = formatDateInterval(new Date(), startDate);
    if (maxItems && cnabs.length >= maxItems) {
      this.logger.log(`Leitura de retornos finalizou a leitura de ${cnabs.length}/${maxItems} CNABs - ${duration}`, METHOD);
    }
    this.logger.log(`Leitura de retornos finalizada com sucesso - ${duration}`, METHOD);
    return { duration, cnabs: cnabs.length, success, failed };
  }

  /**
   * Regras
   */
  public async readRetornoExtrato(folder?: string, maxItems?: number) {
    const METHOD = 'readRetornoExtrato';
    const INVALID_ORIGIN_FOLDERS = ['/backup/extrato/success', '/backup/extrato/failed'];
    if (folder && INVALID_ORIGIN_FOLDERS.includes(folder)) {
      throw CommonHttpException.message(`Não é possível ler retornos das pastas ${INVALID_ORIGIN_FOLDERS}`);
    }

    let cnab = await this.sftpService.getFirstRetornoExtrato();
    const cnabs: string[] = [];
    const success: any[] = [];
    const failed: any[] = [];
    const startDate = new Date();
    while (cnab && (!maxItems || cnabs.length < maxItems)) {
      const startDateItem = new Date();
      cnabs.push(cnab.name);
      try {
        const retorno104 = parseCnab240Extrato(cnab.content);
        await this.saveExtratoFromCnab(retorno104, cnab.name);
        await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.ExtratoSuccess, cnab.content);
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.log(`CNAB '${cnab.name}' lido com sucesso - ${durationItem}`);
        success.push(cnab.name);
      } catch (error) {
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.error(`Erro ao processar CNAB ${cnab.name}. Movendo para backup de erros e finalizando - ${durationItem} - ${formatErrMsg(error)}`, error.stack, METHOD);
        await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.ExtratoFailure, cnab.content);
      }
      cnab = await this.sftpService.getFirstRetornoExtrato(folder);
    }

    const duration = formatDateInterval(new Date(), startDate);
    if (maxItems && cnabs.length >= maxItems) {
      this.logger.log(`Leitura de retornos finalizou a leitura de ${cnabs.length}/${maxItems} CNABs - ${duration}`, METHOD);
    }
    this.logger.log(`Leitura de retornos finalizada com sucesso - ${duration}`, METHOD);
    return { duration, cnabs: cnabs.length, success, failed };
  }

  private async saveExtratoFromCnab(cnab: CnabFile104Extrato, cnabName: string) {
    const saveHeaderArquivo = await this.extHeaderArquivoService.saveFrom104(cnab.headerArquivo, cnabName);
    for (const lote of cnab.lotes) {
      const saveHeaderLote = await this.extHeaderLoteService.saveFrom104(lote.headerLote, saveHeaderArquivo.item);
      for (const registro of lote.registros) {
        await this.extDetalheEService.saveFrom104(registro.detalheE, saveHeaderLote);
      }
    }
  }
  // #endregion

  async clearSyncTransacaoView(args?: IClearSyncOrdemPgto) {
    this.logger.debug('Inicio clear sync TransacaoView');
    const startDate = new Date();
    let count = await this.transacaoViewService.clearSyncOrdemPgto(args);
    const endDate = new Date();
    const duration = formatDateInterval(endDate, startDate);
    this.logger.debug(`Fim clear sync TransacaoView - duração: ${duration}`);
    return { duration, count };
  }
}
