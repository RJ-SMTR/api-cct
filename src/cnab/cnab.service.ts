import { Injectable } from '@nestjs/common';
import { endOfDay, isFriday, nextFriday, nextThursday, startOfDay, subDays } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';
import { SftpService } from 'src/sftp/sftp.service';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { UsersService } from 'src/users/users.service';

import { InjectDataSource } from '@nestjs/typeorm';
import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { cnabSettings } from 'src/settings/cnab.settings';
import { SettingsService } from 'src/settings/settings.service';
import { completeCPFCharacter } from 'src/utils/cpf-cnpj';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateInterval, yearMonthDayToDate } from 'src/utils/date-utils';
import { asNumber } from 'src/utils/pipe-utils';
import { Between, DataSource, QueryRunner } from 'typeorm';
import { HeaderArquivoDTO } from './dto/pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from './dto/pagamento/header-lote.dto';
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

  // #region saveTransacoesJae

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
    let ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemInicialDate, dataOrdemFinalDate, daysBefore);
    let ordensFilter: BigqueryOrdemPagamentoDTO[];
    if (consorcio.trim() === 'Empresa') {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() !== 'VLT' && ordem.consorcio.trim() !== 'STPC' && ordem.consorcio.trim() !== 'STPL');
    } else if (consorcio.trim() === 'Van') {      
      ordensFilter = ordens.filter((ordem) => ordem.consorcio.trim() === 'STPC' || ordem.consorcio.trim() === 'STPL');
    } else {
      ordensFilter = ordens.filter((ordem) => ordem.consorcio === consorcio.trim());
    }
    await this.saveOrdens(ordensFilter);
  }

  async updateTransacaoViewBigqueryLimit(trsBq: BigqueryTransacao[], queryRunner: QueryRunner) {
    for (const trBq of trsBq) {
      const tr = TransacaoView.fromBigqueryTransacao(trBq);
      if (tr.modo && tr.nomeOperadora) {
        const existing = await this.transacaoViewService.find({ idTransacao: tr.idTransacao });
        if (existing.length === 0) {
          this.logger.debug(tr.idTransacao);
          await queryRunner.manager.getRepository(TransacaoView).save(tr);
        }
      }
    }
  }

  /**
   * Atualiza a tabela TransacaoView
   */
  async updateTransacaoViewBigquery(dataOrdemIncial: Date, dataOrdemFinal: Date, daysBack = 0, consorcio: string = 'Todos') {
    const trs = await this.getTransacoesBQ(dataOrdemIncial, dataOrdemFinal, daysBack, consorcio);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      await this.updateTransacaoViewBigqueryLimit(trs, queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Falha ao salvar Informções agrupadas`, error?.stack);
    } finally {
      await queryRunner.release();
    }
  }

  async getTransacoesBQ(dataOrdemIncial: Date, dataOrdemFinal: Date, daysBack = 0, consorcio: string) {
    const transacoesBq = await this.bigqueryTransacaoService.getFromWeek(startOfDay(dataOrdemIncial), endOfDay(dataOrdemFinal), daysBack);
    let trs = transacoesBq;
    if (consorcio === 'Van') {
      trs = transacoesBq.filter((tr) => tr.consorcio === 'STPC' || tr.consorcio === 'STPL');
    } else if (consorcio == 'Empresa') {
      trs = transacoesBq.filter((tr) => tr.consorcio !== 'STPC' && tr.consorcio !== 'STPL');
    }
    return trs;
  }

  public async getTransacoesViewOrdem(dataCaptura: Date, itemAg: ItemTransacaoAgrupado, clienteFavorecido: ClienteFavorecido) {
    const dataVencimento = nextFriday(dataCaptura);

    let daysbefore = 9;
    if (itemAg.nomeConsorcio === 'VLT') {
      daysbefore = 2;
    }
    const trsDia = await this.getTransacoesViewWeek(subDays(startOfDay(dataVencimento), daysbefore), subDays(endOfDay(dataVencimento), 1));
    const trsOrdem = trsDia.filter((transacaoView) => transacaoView.idOperadora === itemAg.idOperadora && transacaoView.idConsorcio === itemAg.idConsorcio && transacaoView.operadoraCpfCnpj === clienteFavorecido.cpfCnpj);
    return trsOrdem;
  }

  /**
   * Salvar Transacao / ItemTransacao e agrupados
   */
  async saveOrdens(ordens: BigqueryOrdemPagamentoDTO[]) {
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;

    for (const ordem of ordens) {
      const cpfCnpj = ordem.consorcioCnpj || ordem.operadoraCpfCnpj;
      if (!cpfCnpj) {
        continue;
      }
      const favorecido = await this.clienteFavorecidoService.findOne({
        where: { cpfCnpj: completeCPFCharacter(cpfCnpj, 0) },
      });
      if (!favorecido) {
        continue;
      }
      if(favorecido.cpfCnpj ==='38226936772'){
        await this.saveAgrupamentos(ordem, pagador, favorecido);
      }
    }
  }

  private async saveUpdateItemTransacaoAg(transacaoAg: TransacaoAgrupado, ordem: BigqueryOrdemPagamentoDTO, queryRunner: QueryRunner) {
    let itemAg = await this.itemTransacaoAgService.findOne({
      where: {
        transacaoAgrupado: {
          id: transacaoAg.id,
          status: { id: TransacaoStatusEnum.created },
        },
        ...(ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL' ? { idOperadora: ordem.idOperadora } : { idConsorcio: ordem.idConsorcio }),
      },
    });
    if (itemAg) {
      itemAg.valor += asNumber(ordem.valorTotalTransacaoLiquido);
    } else {
      itemAg = this.convertItemTransacaoAgrupadoDTO(ordem, transacaoAg);
    }
    return await this.itemTransacaoAgService.save(itemAg, queryRunner);
  }

  async saveAgrupamentos(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador, favorecido: ClienteFavorecido) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let itemAg: ItemTransacaoAgrupado | null = null;
    try {
      await queryRunner.startTransaction();
      this.logger.debug('Salva Agrupamento Consorcio: ' + ordem.consorcio);
      const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
      const fridayOrdem = nextFriday(startOfDay(dataOrdem));
      this.logger.debug('Inicia Consulta TransacaoAgrupado');
      let transacaoAg = await this.transacaoAgService.findOne({
        dataOrdem: fridayOrdem,
        pagador: { id: pagador.id },
        status: { id: TransacaoStatusEnum.created },
      });

      this.logger.debug(ordem.consorcio);
      if (transacaoAg) {
        itemAg = await this.saveUpdateItemTransacaoAg(transacaoAg, ordem, queryRunner);
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

  async sincronizeTransacaoViewOrdemPgto(dataOrdemInicial: string, dataOrdemFinal: string, nomeFavorecido: string[] = []) {
    this.logger.debug('Inicio Sync TransacaoView');
    const where: string[] = [`DATE(tv."datetimeProcessamento") BETWEEN (DATE('${dataOrdemInicial}') - INTERVAL '1 DAY') AND '${dataOrdemFinal}'`];
    if (nomeFavorecido.length) {
      where.push(`cf.nome ILIKE ANY(ARRAY['%${nomeFavorecido.join("%', '%")}%'])`);
    }
    const query = `
    UPDATE transacao_view
    SET "itemTransacaoAgrupadoId" = associados.ita_id,
        "updatedAt" = NOW()
    FROM (
        SELECT
            DISTINCT ON (tv.id)
            tv.id AS tv_id,
            ita.id AS ita_id
        FROM item_transacao_agrupado ita
        INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
        INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
        INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
        INNER JOIN transacao_view tv
            ON tv."idConsorcio" = ita."idConsorcio"
            AND tv."idOperadora" = ita."idOperadora"
            AND tv."operadoraCpfCnpj" = cf."cpfCnpj"
            AND tv."datetimeProcessamento"::DATE BETWEEN
                (ita."dataCaptura"::DATE + (12 - EXTRACT(DOW FROM ita."dataCaptura"::DATE)::integer + 7) % 7 + (CASE WHEN EXTRACT(DOW FROM ita."dataCaptura"::DATE) = 5 THEN 7 ELSE 0 END)) - (CASE WHEN ita."nomeConsorcio" = 'VLT' THEN (INTERVAL '2 days') ELSE (INTERVAL '9 days') END)${'' /** start_date: proxima_sexta - 2/9 dias (VLT/outros) (qua/qua x2) */}
                AND (ita."dataCaptura"::DATE + (12 - EXTRACT(DOW FROM ita."dataCaptura"::DATE)::integer + 7) % 7 + (CASE WHEN EXTRACT(DOW FROM ita."dataCaptura"::DATE) = 5 THEN 7 ELSE 0 END)) - INTERVAL '1 day'${'' /** end_date: prox_sexta - 1 dia (qua) */}${where.length ? `\n        WHERE (${where.join(') AND (')})` : ''}
        ORDER BY tv.id ASC, ita.id DESC
    ) associados
    WHERE id = associados.tv_id
    RETURNING id, "itemTransacaoAgrupadoId", "updatedAt"
    `;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const startDate = new Date();
    let count = 0;
    try {
      await queryRunner.startTransaction();
      [, count] = await queryRunner.query(query);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    const endDate = new Date();
    const duration = formatDateInterval(endDate, startDate);
    this.logger.debug(`Fim Sync TransacaoView - duração: ${duration}`);
    return { duration, count };
  }

  private async saveTransacaoAgrupado(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador) {
    const transacaoAg = this.convertTransacaoAgrupadoDTO(ordem, pagador);
    return await this.transacaoAgService.save(transacaoAg);
  }

  private async saveItemTransacaoAgrupado(ordem: BigqueryOrdemPagamentoDTO, transacaoAg: TransacaoAgrupado, queryRunner: QueryRunner) {
    const itemAg = this.convertItemTransacaoAgrupadoDTO(ordem, transacaoAg);
    return await this.itemTransacaoAgService.save(itemAg, queryRunner);
  }

  /**
   * Save or update Transacao.
   *
   * Unique id: `idOrdemPagamento`
   */
  async saveTransacao(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador, transacaoAgId: number, queryRunner: QueryRunner): Promise<Transacao> {
    const transacao = this.convertTransacao(ordem, pagador, transacaoAgId);
    return await this.transacaoService.save(transacao, queryRunner);
  }

  private convertTransacao(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador, transacaoAgId: number) {
    return new Transacao({ dataOrdem: ordem.dataOrdem, dataPagamento: ordem.dataPagamento, pagador: pagador, idOrdemPagamento: ordem.idOrdemPagamento, transacaoAgrupado: { id: transacaoAgId } });
  }

  convertTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO, pagador: Pagador) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    /** semana de pagamento: sex-qui */
    const fridayOrdem = nextFriday(startOfDay(dataOrdem));
    const transacao = new TransacaoAgrupado({
      dataOrdem: fridayOrdem,
      dataPagamento: ordem.dataPagamento,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      status: TransacaoStatus.fromEnum(TransacaoStatusEnum.created),
    });
    return transacao;
  }

  convertItemTransacaoAgrupadoDTO(ordem: BigqueryOrdemPagamentoDTO, transacaoAg: TransacaoAgrupado) {
    const dataOrdem = yearMonthDayToDate(ordem.dataOrdem);
    const fridayOrdem = nextFriday(nextThursday(startOfDay(dataOrdem)));
    const item = new ItemTransacaoAgrupado({
      dataCaptura: ordem.dataOrdem,
      dataOrdem: fridayOrdem,
      idConsorcio: ordem.idConsorcio,
      idOperadora: ordem.idOperadora,
      idOrdemPagamento: ordem.idOrdemPagamento,
      nomeConsorcio: ordem.consorcio,
      nomeOperadora: ordem.operadora,
      valor: ordem.valorTotalTransacaoLiquido,
      transacaoAgrupado: transacaoAg,
    });
    return item;
  }

  async saveItemTransacaoPublicacao(ordem: BigqueryOrdemPagamentoDTO, favorecido: ClienteFavorecido, transacao: Transacao, itemTransacaoAg: ItemTransacaoAgrupado, queryRunner: QueryRunner) {
    const item = this.convertItemTransacao(ordem, favorecido, transacao, itemTransacaoAg);
    await this.itemTransacaoService.save(item, queryRunner);
    const publicacao = await this.arquivoPublicacaoService.convertPublicacaoDTO(item);
    await this.arquivoPublicacaoService.save(publicacao, queryRunner);
  }

  private convertItemTransacao(ordem: BigqueryOrdemPagamentoDTO, favorecido: ClienteFavorecido, transacao: Transacao, itemTransacaoAg: ItemTransacaoAgrupado) {
    return new ItemTransacao({
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
      itemTransacaoAgrupado: { id: itemTransacaoAg.id },
    });
  }

  async getTransacoesViewWeek(dataInicio: Date, dataFim: Date) {
    let friday = new Date();
    let startDate;
    let endDate;

    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }

    if (dataInicio != undefined && dataFim != undefined) {
      startDate = dataInicio;
      endDate = dataFim;
    } else {
      startDate = startOfDay(subDays(friday, 8));
      endDate = endOfDay(subDays(friday, 2));
    }
    return await this.transacaoViewService.find({ datetimeProcessamento: Between(startDate, endDate) }, false);
  }

  public async saveTransacoesLancamento() {
    await this.updateAllFavorecidosFromUsers();
    const newLancamentos = await this.lancamentoService.findToPayWeek();
    const favorecidos = newLancamentos.map((i) => i.id_cliente_favorecido);
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;
    const transacaoDTO = this.transacaoService.generateDTOForLancamento(pagador, newLancamentos);
    const savedTransacao = await this.transacaoService.saveForLancamento(transacaoDTO);
    const updatedLancamentos = savedTransacao.lancamentos as LancamentoEntity[];
    const itemTransacaoDTOs = this.itemTransacaoService.generateDTOsFromLancamentos(updatedLancamentos, favorecidos);
    await this.itemTransacaoService.saveMany(itemTransacaoDTOs);
  }

  private async updateAllFavorecidosFromUsers() {
    const allUsers = await this.usersService.findManyRegisteredUsers();
    await this.clienteFavorecidoService.updateAllFromUsers(allUsers);
  }

  public async generateRemessa(args: {
    tipo: PagadorContaEnum; //
    dataPgto?: Date;
    isConference: boolean;
    isCancelamento: boolean;
    /** Default: current NSA */
    nsaInicial?: number;
    /** Default: nsaInicial */
    nsaFinal?: number;
    dataCancelamento?: Date;
  }): Promise<string[]> {
    const currentNSA = parseInt((await this.settingsService.getOneBySettingData(cnabSettings.any__cnab_current_nsa)).value);

    const { tipo, dataPgto, isConference, isCancelamento } = args;
    let nsaInicial = args.nsaInicial || currentNSA;
    let nsaFinal = args.nsaFinal || nsaInicial;
    const dataCancelamento = args?.dataCancelamento || new Date();

    const METHOD = this.sendRemessa.name;
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
          const headerArquivoDTO = await this.remessaRetornoService.saveHeaderArquivoDTO(transacaoAg, isConference);
          const lotes = await this.remessaRetornoService.getLotes(transacaoAg.pagador, headerArquivoDTO, isConference, dataPgto);
          const cnab104 = this.remessaRetornoService.generateFile(headerArquivoDTO, lotes);
          if (headerArquivoDTO && cnab104) {
            const [cnabStr, processedCnab104] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
            for (const processedLote of processedCnab104.lotes) {
              const savedLote = lotes.filter((i) => i.formaLancamento === processedLote.headerLote.formaLancamento.value)[0];
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
          headerArquivoDTO.nsa = await this.headerArquivoService.getNextNSA();
          const lotes = await this.getLotesCancelar(index);
          const lotesDto: HeaderLoteDTO[] = [];
          let detalhes: CnabRegistros104Pgto[] = [];
          for (const lote of lotes) {
            const headerLoteDTO = this.headerLoteService.convertHeaderLoteDTO(headerArquivoDTO, lote.pagador, lote.formaLancamento == '41' ? Cnab104FormaLancamento.TED : Cnab104FormaLancamento.CreditoContaCorrente);
            const detalhesA = (await this.detalheAService.findMany({ headerLote: { id: lote.id } })).sort((a, b) => a.nsr - b.nsr);
            for (const detalheA of detalhesA) {
              const detalhe = await this.remessaRetornoService.saveDetalhes104(detalheA.numeroDocumentoEmpresa, headerLoteDTO, detalheA.itemTransacaoAgrupado, detalheA.nsr, false, detalheA.dataVencimento, true, detalheA);
              if (detalhe) {
                detalhes.push(detalhe);
              }
            }
            headerLoteDTO.registros104 = detalhes;
            lotesDto.push(headerLoteDTO);
            detalhes = [];
          }
          const cnab104 = this.remessaRetornoService.generateFile(headerArquivoDTO, lotesDto, true, dataCancelamento);
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
    await this.transacaoAgService.save({
      id: transacaoAgId,
      status: TransacaoStatus.fromEnum(TransacaoStatusEnum.remessa),
    });
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
    for (const cnabStr of listCnab) {
      await this.sftpService.submitCnabRemessa(cnabStr);
    }
  }

  /**
   *
   * @param folder Example: `/retorno`
   * @returns
   */
  public async updateRetorno(folder?: string) {
    const METHOD = this.updateRetorno.name;
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
      } catch (error) {
        const durationItem = formatDateInterval(new Date(), startDateItem);
        this.logger.error(`Erro ao processar CNAB retorno (${durationItem}), movendo para backup de erros e finalizando... - ${error}`, error.stack, METHOD);
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
