import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { LancamentoStatus } from 'src/lancamento/enums/lancamento-status.enum';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { SettingsService } from 'src/settings/settings.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { ISyncOrdemPgto } from 'src/transacao-view/interfaces/sync-form-ordem.interface';
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
import { DataSource, DeepPartial, QueryRunner } from 'typeorm';
import { HeaderArquivoDTO } from './dto/pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from './dto/pagamento/header-lote.dto';
import { OrdemPagamentoDto } from './dto/pagamento/ordem-pagamento.dto';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from './entity/pagamento/transacao-status.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { Cnab104FormaLancamento } from './enums/104/cnab-104-forma-lancamento.enum';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { TransacaoStatusEnum } from './enums/pagamento/transacao-status.enum';
import { CnabHeaderArquivo104 } from './interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabFile104Extrato } from './interfaces/cnab-240/104/extrato/cnab-file-104-extrato.interface';
import { CnabRegistros104Pgto } from './interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { AllPagadorDict } from './interfaces/pagamento/all-pagador-dict.interface';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { ItemTransacaoAgrupadoService } from './service/pagamento/item-transacao-agrupado.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoAgrupadoService } from './service/pagamento/transacao-agrupado.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import { parseCnab240Extrato, parseCnab240Pagamento, stringifyCnab104File } from './utils/cnab/cnab-104-utils';

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
    private extDetalheEService: ExtratoDetalheEService,
    private extHeaderArquivoService: ExtratoHeaderArquivoService,
    private extHeaderLoteService: ExtratoHeaderLoteService,
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    private lancamentoService: LancamentoService,
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
  ) {}

  async getGenerateRemessaJae(args: {
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

    this.logger.log('saveTransacoesJae iniciado');
    await this.saveTransacoesJae(dataOrdemInicial, dataOrdemFinal, diasAnteriores, consorcio);
    duration.saveTransacoesJae = formatDateInterval(new Date(), now);
    now = new Date();
    this.logger.log(`saveTransacoesJae finalizado - ${duration.saveTransacoesJae}`);

    this.logger.log('generateRemessa started');
    const listCnab = await this.generateRemessa({
      tipo: PagadorContaEnum.ContaBilhetagem, //
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
    this.logger.log(`generateRemessa finalizado - ${duration.generateRemessa}`);

    this.logger.log('sendRemessa started');
    const cnabs = await this.sendRemessa(listCnab);
    duration.sendRemessa = formatDateInterval(new Date(), now);
    this.logger.log(`sendRemessa finalizado - ${duration.sendRemessa}`);

    duration.total = formatDateInterval(new Date(), startDate);
    this.logger.log(`Tarefa finalizada - ${duration.total}`);
    return {
      duration,
      cnabs,
    };
  }

  async getGenerateRemessaLancamento(args: {
    dataOrdemInicial?: Date; //
    dataOrdemFinal?: Date;
    dataPgto: Date | undefined;
    isConference: boolean;
    isCancelamento: boolean;
    isTeste: boolean;
    nsaInicial: number | undefined;
    nsaFinal: number | undefined;
    dataCancelamento: Date | undefined;
  }) {
    const METHOD = 'getGenerateRemessaLancamento';
    const { dataCancelamento, dataOrdemFinal, dataOrdemInicial, dataPgto, isCancelamento, isConference, isTeste, nsaFinal, nsaInicial } = args;
    const duration = { saveTransacoesJae: '', generateRemessa: '', sendRemessa: '', total: '' };
    const startDate = new Date();
    let now = new Date();
    this.logger.log('Tarefa iniciada', METHOD);

    this.logger.log('saveTransacoesJae iniciado');
    await this.saveTransacoesLancamento(dataOrdemInicial, dataOrdemFinal);
    duration.saveTransacoesJae = formatDateInterval(new Date(), now);
    now = new Date();
    this.logger.log(`saveTransacoesJae finalizado - ${duration.saveTransacoesJae}`);

    this.logger.log('generateRemessa started');
    const listCnab = await this.generateRemessa({
      tipo: PagadorContaEnum.CETT, //
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
    this.logger.log(`generateRemessa finalizado - ${duration.generateRemessa}`);

    this.logger.log('sendRemessa started');
    const cnabs = await this.sendRemessa(listCnab);
    duration.sendRemessa = formatDateInterval(new Date(), now);
    this.logger.log(`sendRemessa finalizado - ${duration.sendRemessa}`);

    duration.total = formatDateInterval(new Date(), startDate);
    this.logger.log(`Tarefa finalizada - ${duration.total}`);
    return {
      duration,
      cnabs,
    };
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
              valorPago: bq.valor_pagamento || isContent(tv.valorPago) ? tv.valorPago : null,
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
  public async saveTransacoesJae(dataOrdemIncial: Date, dataOrdemFinal: Date, daysBefore = 0, consorcio: 'VLT' | 'Van' | 'Empresa' | 'Todos' | string) {
    const dataOrdemInicialDate = startOfDay(new Date(dataOrdemIncial));
    const dataOrdemFinalDate = endOfDay(new Date(dataOrdemFinal));
    await this.updateAllFavorecidosFromUsers();
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemInicialDate, dataOrdemFinalDate, daysBefore);
    let ordensFilter: BigqueryOrdemPagamentoDTO[];
    if (consorcio.trim() === 'Empresa') {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() !== 'VLT' && ordem.consorcio.trim() !== 'STPC' && ordem.consorcio.trim() !== 'STPL');
    } else if (consorcio.trim() === 'Van') {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() === 'STPC' || ordem.consorcio.trim() === 'STPL');
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
    try {
      await queryRunner.startTransaction();
      this.logger.debug(`Salvando Agrupamento - ${JSON.stringify({ consorcio: ordem.consorcio, operadora: ordem.operadora, favorecidoCpfCnpj: ordem.favorecidoCpfCnpj })}`, METHOD);
      let transacaoAg = await this.transacaoAgService.findOne({
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
      this.logger.error(`Falha ao salvar Informções agrupadas`, error?.stack);
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
            ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL'
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
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

  public async saveTransacoesLancamento(dataOrdemInicial?: Date, dataOrdemFinal?: Date) {
    const dataOrdem: [Date, Date] | undefined = dataOrdemInicial && dataOrdemFinal ? [startOfDay(dataOrdemInicial), endOfDay(dataOrdemFinal)] : undefined;
    await this.updateAllFavorecidosFromUsers();
    const newLancamentos = await this.lancamentoService.findToPay(dataOrdem);
    const ordens = newLancamentos.cett.map((l) => OrdemPagamentoDto.fromLancamento(l));
    await this.saveOrdens(ordens, 'cett');
  }

  public async generateRemessa(args: {
    tipo: PagadorContaEnum; //
    dataPgto?: Date;
    isConference: boolean;
    isCancelamento: boolean;
    isTeste: boolean;
    /** Default: current NSA */
    nsaInicial?: number;
    /** Default: nsaInicial */
    nsaFinal?: number;
    dataCancelamento?: Date;
  }): Promise<string[]> {
    const METHOD = 'generateRemessa';
    const { tipo, dataPgto, isConference, isCancelamento, isTeste } = args;

    const currentNSA = await this.settingsService.getCurrentNSA(isTeste);
    let nsaInicial = args.nsaInicial || currentNSA;
    let nsaFinal = args.nsaFinal || nsaInicial;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const listCnab: string[] = [];
      if (!isCancelamento) {
        const transacoesAg = await this.transacaoAgService.findAllNewTransacao(tipo);
        if (!transacoesAg.length) {
          this.logger.log(`Não há transações novas para gerar remessa, nada a fazer...`, METHOD);
          return [];
        }
        for (const transacaoAg of transacoesAg) {
          const headerArquivoDTO = await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg, isConference, isTeste);
          const headerLoteDTOs = await this.remessaRetornoService.getLotes(transacaoAg.pagador, headerArquivoDTO, isConference, isTeste, dataPgto);
          const cnab104 = this.remessaRetornoService.generateFile({ headerArquivoDTO, headerLoteDTOs, isTeste });
          if (headerArquivoDTO && cnab104) {
            const [cnabStr, processedCnab104] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
            for (const processedLote of processedCnab104.lotes) {
              const savedLote = headerLoteDTOs.filter((i) => i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
              await this.remessaRetornoService.updateHeaderLoteDTOFrom104(savedLote, processedLote.headerLote, isConference);
            }
            if (!isConference) {
              await this.updateStatusRemessa(headerArquivoDTO, processedCnab104.headerArquivo, transacaoAg.id);
            }
            if (cnabStr) {
              listCnab.push(cnabStr);
            }
          }
        }
      } else {
        if (this.validateCancel(nsaInicial, nsaFinal)) {
          return [];
        }

        for (let index = nsaInicial; nsaInicial < nsaFinal + 1; nsaInicial++) {
          const headerArquivoDTO = await this.getHeaderArquivoCancelar(index);
          headerArquivoDTO.nsa = await this.settingsService.getNextNSA(isTeste);
          const lotes = await this.getLotesCancelar(index);
          const headerLoteDTOs: HeaderLoteDTO[] = [];
          let detalhes: CnabRegistros104Pgto[] = [];
          for (const lote of lotes) {
            const headerLoteDTO = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, lote.pagador, lote.formaLancamento == '41' ? Cnab104FormaLancamento.TED : Cnab104FormaLancamento.CreditoContaCorrente, isTeste);
            const detalhesA = (await this.detalheAService.findMany({ headerLote: { id: lote.id } })).sort((a, b) => a.nsr - b.nsr);
            for (const detalheA of detalhesA) {
              const detalhe = await this.remessaRetornoService.saveDetalhes104(detalheA.numeroDocumentoEmpresa, headerLoteDTO, detalheA.itemTransacaoAgrupado, detalheA.nsr, false, detalheA.dataVencimento, true, detalheA);
              if (detalhe) {
                detalhes.push(detalhe);
              }
            }
            headerLoteDTO.registros104 = detalhes;
            headerLoteDTOs.push(headerLoteDTO);
            detalhes = [];
          }
          const cnab104 = this.remessaRetornoService.generateFile({ headerArquivoDTO, headerLoteDTOs, isCancelamento: true, isTeste });
          if (headerArquivoDTO && cnab104) {
            const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
            if (!cnabStr) {
              continue;
            }
            listCnab.push(cnabStr);
          }
        }
      }
      await queryRunner.commitTransaction();
      return listCnab;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Falha ao salvar Informções agrupadas`, error?.stack);
    } finally {
      await queryRunner.release();
    }
    return [];
  }

  private async updateStatusRemessa(headerArquivoDTO: HeaderArquivoDTO, cnabHeaderArquivo: CnabHeaderArquivo104, transacaoAgId: number) {
    await this.remessaRetornoService.updateHeaderArquivoDTOFrom104(headerArquivoDTO, cnabHeaderArquivo);
    await this.transacaoAgService.save({ id: transacaoAgId, status: TransacaoStatus.fromEnum(TransacaoStatusEnum.remessa) });
    await this.lancamentoService.updateRaw({ status: LancamentoStatus._3_remessa }, { transacaoAgrupadoId: transacaoAgId });
  }

  private validateCancel(nsaInicial: number, nsaFinal: number) {
    return (nsaInicial == undefined && nsaFinal == undefined) || (nsaFinal != 0 && nsaFinal < nsaInicial);
  }

  private async getLotesCancelar(nsa: number) {
    return (await this.headerLoteService.findMany({ headerArquivo: { nsa: nsa } })).sort((a, b) => a.loteServico - b.loteServico);
  }

  private async getHeaderArquivoCancelar(nsa: number) {
    return await this.headerArquivoService.getHeaderArquivoNsa(nsa);
  }

  public async sendRemessa(listCnab: string[]) {
    const cnabs: { name: string; content: string }[] = [];
    for (const cnabStr of listCnab) {
      const cnabName = await this.sftpService.submitCnabRemessa(cnabStr);
      cnabs.push({ name: cnabName, content: cnabStr });
    }
    return cnabs;
  }

  /**
   *
   * @param folder Example: `/retorno`
   * @returns
   */
  public async updateRetorno(folder?: string, maxItems?: number) {
    const METHOD = this.updateRetorno.name;
    const INVALID_FOLDERS = ['/backup/retorno/success', '/backup/retorno/failed'];
    if (folder && INVALID_FOLDERS.includes(folder)) {
      throw CommonHttpException.message(`Não é possível ler retornos das pastas ${INVALID_FOLDERS}`);
    }
    let { cnabName, cnabString } = await this.sftpService.getFirstCnabRetorno(folder);
    const cnabs: string[] = [];
    const success: any[] = [];
    const failed: any[] = [];
    const startDate = new Date();
    while (cnabString) {
      if (!cnabName || !cnabString) {
        this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
        return;
      }
      this.logger.log('Leitura de retornos iniciada...', METHOD);
      const startDateItem = new Date();
      try {
        const retorno104 = parseCnab240Pagamento(cnabString);
        cnabs.push(cnabName);
        await this.remessaRetornoService.saveRetorno(retorno104);
        await this.sftpService.moveToBackup(cnabName, SftpBackupFolder.RetornoSuccess, cnabString, folder);
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.log(`CNAB '${cnabName}' lido com sucesso - ${durationItem}`);
        success.push(cnabName);
        break;
      } catch (error) {
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.error(`Erro ao processar CNAB ${cnabName}. Movendo para backup de erros e finalizando - ${durationItem} - ${formatErrMsg(error)}`, error.stack, METHOD);
        if (!cnabName || !cnabString) {
          this.logger.log('Retorno não encontrado, abortando tarefa.', METHOD);
          return;
        }
        await this.sftpService.moveToBackup(cnabName, SftpBackupFolder.RetornoFailure, cnabString, folder);
        failed.push(cnabName);
      }
      const cnab = await this.sftpService.getFirstCnabRetorno(folder);
      cnabString = cnab.cnabString;
      cnabName = cnab.cnabName;
    }
    const duration = formatDateInterval(new Date(), startDate);
    if (maxItems && cnabs.length >= maxItems) {
      this.logger.log(`Leitura de retornos finalizou a leitura de ${cnabs.length}/${maxItems} CNABs - ${duration}`, METHOD);
    }
    this.logger.log(`Leitura de retornos finalizada com sucesso - ${duration}`, METHOD);
    return { duration, cnabs: cnabs.length, success, failed };
  }

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
      await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess, cnab.content);
    } catch (error) {
      this.logger.error('Erro ao processar CNAB extrato, movendo para backup de erros e finalizando...', error, METHOD);
      await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure, cnab.content);
    }
    return;
  }

  private async saveExtratoFromCnab(cnab: CnabFile104Extrato) {
    const saveHeaderArquivo = await this.extHeaderArquivoService.saveFrom104(cnab.headerArquivo);
    for (const lote of cnab.lotes) {
      const saveHeaderLote = await this.extHeaderLoteService.saveFrom104(lote.headerLote, saveHeaderArquivo.item);
      for (const registro of lote.registros) {
        await this.extDetalheEService.saveFrom104(registro.detalheE, saveHeaderLote);
      }
    }
  }
  // #endregion
}
