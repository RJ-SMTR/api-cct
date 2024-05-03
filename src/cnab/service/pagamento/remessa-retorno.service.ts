import { Injectable, Logger } from '@nestjs/common';
import { ItemTransacaoDTO } from 'src/cnab/dto/pagamento/item-transacao.dto';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { CustomLogger } from 'src/utils/custom-logger';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asDate, asNumber, asString } from 'src/utils/pipe-utils';
import { DeepPartial } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { ItemTransacaoStatus } from '../../entity/pagamento/item-transacao-status.entity';
import { ItemTransacao } from '../../entity/pagamento/item-transacao.entity';
import { TransacaoStatus } from '../../entity/pagamento/transacao-status.entity';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { ItemTransacaoStatusEnum } from '../../enums/pagamento/item-transacao-status.enum';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';
import { CnabHeaderArquivo104 } from '../../interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabDetalheA_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabHeaderLote104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import {
  CnabRemessa,
  CnabRemessaDTO,
  CnabRemessaDetalhe,
} from '../../interfaces/cnab-all/cnab-remsesa.interface';
import { stringifyCnab104File } from '../../utils/cnab/cnab-104-utils';
import { getTipoInscricao } from '../../utils/cnab/cnab-utils';
import { ArquivoPublicacaoService } from '../arquivo-publicacao.service';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderArquivoService } from './header-arquivo.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoService } from './item-transacao.service';
import { TransacaoService } from './transacao.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class RemessaRetornoService {
  private logger: Logger = new CustomLogger('CnabPagamentoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoService: ItemTransacaoService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private transacaoService: TransacaoService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private arquivoPublicacaoService: ArquivoPublicacaoService,
  ) {}

  // #region saveRemessa

  /**
   * Save many if not exists
   */
  public async saveManyRemessa(
    cnabDTOs: CnabRemessaDTO[],
    isAgrupado: boolean,
  ) {
    // Flatten Cnab to bulk save
    const {
      allUpdatedTransacoes,
      allHeaderArquivo,
      allHeaderLoteMap,
      allItemDetalheAMap,
      allDetalheBMap,
    } = this.flattenCnabDTOs(cnabDTOs);

    // Bulk save HeaderArquivo
    const allSavedHeaderArquivo =
      await this.headerArquivoService.saveManyIfNotExists(allHeaderArquivo);

    // Bulk save HeaderLote
    const allHeaderLote = this.updateHeaderLoteMap(
      allHeaderLoteMap,
      allSavedHeaderArquivo,
    );
    const allSavedHeaderLote = await this.headerLoteService.saveManyIfNotExists(
      allHeaderLote,
    );

    // Bulk save DetalheA
    const allDetalheA = this.updateDetalheAMap(
      allItemDetalheAMap,
      allSavedHeaderLote,
    );
    const savedDetalheA = await this.detalheAService.saveManyIfNotExists(
      allDetalheA,
    );

    // Update itemTransacao
    await this.updateItemTransacaoRemessa(allItemDetalheAMap, isAgrupado);

    // Bulk save DetalheB
    const allDetalheB = this.updateDetalheBMap(allDetalheBMap, savedDetalheA);
    await this.detalheBService.saveManyIfNotExists(allDetalheB);

    // Update Transacao status
    await this.transacaoService.updateMany(allUpdatedTransacoes);
  }

  private async updateItemTransacaoRemessa(
    allItemDetalheAMap: Record<
      string,
      DeepPartial<ItemTransacao>[] | DeepPartial<ItemTransacaoAgrupado>[]
    >,
    isAgrupado: boolean,
  ) {
    const itens = Object.values(allItemDetalheAMap).reduce(
      (l, i) => [...l, ...i],
      [],
    );
    const itensToUpdate: DeepPartial<ItemTransacao>[] = [];
    for (const itemTransacao of itens) {
      const detalheA = itemTransacao.detalheA as DetalheA;
      if (!itemTransacao) {
        throw CommonHttpException.notFound('itemTransacao');
      }
      itensToUpdate.push({
        id: itemTransacao.id,
        detalheA: { id: detalheA.id },
      });
      const updateItemTransacao: DeepPartial<ItemTransacao> = {
        detalheA: { id: detalheA.id },
      };
      if (isAgrupado) {
        await this.itemTransacaoAgService.update(
          asNumber(itemTransacao?.id),
          updateItemTransacao,
        );
      } else {
        await this.itemTransacaoService.update(
          asNumber(itemTransacao?.id),
          updateItemTransacao,
        );
      }
    }
  }

  private updateHeaderLoteMap(
    allHeaderLoteMap: Record<string, DeepPartial<HeaderLote>[]>,
    allSavedHeaderArquivo: HeaderArquivo[],
  ): DeepPartial<HeaderLote>[] {
    /** key: HeaderArquivo unique id */
    const allSavedHeaderArquivoMap: Record<string, HeaderArquivo> =
      allSavedHeaderArquivo.reduce(
        (m, i) => ({ ...m, [HeaderArquivo.getUniqueId(i)]: i }),
        {},
      );

    const allHeaderLote: DeepPartial<HeaderLote>[] = [];
    for (const [uniqueHeaderArqId, headerLotes] of Object.entries(
      allHeaderLoteMap,
    )) {
      for (const headerLote of headerLotes) {
        const headerArquivo = allSavedHeaderArquivoMap[uniqueHeaderArqId];
        if (headerArquivo) {
          headerLote.headerArquivo = { id: headerArquivo.id }; // update
          allHeaderLote.push(headerLote);
        }
      }
    }
    return allHeaderLote;
  }

  private updateDetalheAMap(
    allItemDetalheAMap: Record<string, DeepPartial<ItemTransacao>[]>,
    allSavedHeaderLote: HeaderLote[],
  ): DeepPartial<DetalheA>[] {
    /** key: HeaderLote unique ID */
    const allSavedHeaderLoteMap: Record<string, HeaderLote> =
      allSavedHeaderLote.reduce(
        (m, i) => ({ ...m, [HeaderLote.getUniqueId(i)]: i }),
        {},
      );

    const allDetalheA: DeepPartial<DetalheA>[] = [];
    for (const [headerLoteUniqueId, itemDetalhesA] of Object.entries(
      allItemDetalheAMap,
    )) {
      for (const itemDetalheA of itemDetalhesA) {
        const headerLote = allSavedHeaderLoteMap[headerLoteUniqueId];
        const detalheA = itemDetalheA.detalheA as DeepPartial<DetalheA>;
        if (headerLote) {
          detalheA.headerLote = {
            id: headerLote.id,
            headerArquivo: { id: headerLote.headerArquivo.id },
          }; // update
          allDetalheA.push(detalheA);
        }
      }
    }
    return allDetalheA;
  }

  private updateDetalheBMap(
    allDetalheBMap: Record<string, DeepPartial<DetalheB>[]>,
    allSavedDetalheA: DetalheA[],
  ): DeepPartial<DetalheB>[] {
    /** key: DetalheA unique ID */
    const allSavedDetalheAMap: Record<string, DetalheA> =
      allSavedDetalheA.reduce(
        (m, i) => ({ ...m, [DetalheA.getUniqueId(i)]: i }),
        {},
      );

    // Update DetalheB
    const allDetalheB: DeepPartial<DetalheB>[] = [];
    for (const [detalheAUniqueid, detalhesB] of Object.entries(
      allDetalheBMap,
    )) {
      for (const detalheB of detalhesB) {
        const detalheA = allSavedDetalheAMap[detalheAUniqueid];
        if (detalheA) {
          detalheB.detalheA = { id: detalheA.id }; // update
          allDetalheB.push(detalheB);
        }
      }
    }
    return allDetalheB;
  }

  /**
   * Planificar CnabDTOs
   */
  private flattenCnabDTOs(cnabDTOs: CnabRemessaDTO[]) {
    /** Transacao to update after success */
    const allUpdatedTransacoes: Transacao[] | TransacaoAgrupado[] = [];
    const allHeaderArquivo: HeaderArquivoDTO[] = [];
    /** key: HeaderArquivo HeaderArquivo unique id */
    const allHeaderLoteMap: Record<string, DeepPartial<HeaderLote>[]> = {};
    /** key: HeaderLote unique ID */
    const allItemDetalheAMap: Record<
      string,
      DeepPartial<ItemTransacao>[] | DeepPartial<ItemTransacaoAgrupado>[]
    > = {};
    /** key: HeaderLote + DetalheA nested unique ID */
    const allDetalheBMap: Record<string, DeepPartial<DetalheB>[]> = {};

    for (const cnab of cnabDTOs) {
      // Transacao
      allUpdatedTransacoes.push({
        id: cnab.transacao.id,
        status: new TransacaoStatus(TransacaoStatusEnum.remessaSent),
      } as any);

      // HeaderArquivo
      allHeaderArquivo.push(cnab.headerArquivo);
      const headerArqUniqueId = HeaderArquivo.getUniqueId(cnab.headerArquivo);
      for (const lote of cnab.lotes) {
        lote.headerLote.headerArquivo = cnab.headerArquivo as HeaderArquivo;
        const headerLoteUniqueId = HeaderLote.getUniqueId(lote.headerLote);
        // HeaderLote
        if (!allHeaderLoteMap[headerArqUniqueId]) {
          allHeaderLoteMap[headerArqUniqueId] = [lote.headerLote];
        } else {
          allHeaderLoteMap[headerArqUniqueId].push(lote.headerLote);
        }

        for (const detalhe of lote.detalhes) {
          // DetalheA
          const itemTransacao = this.getRemessaItemDetalheADTO(
            detalhe,
            lote.headerLote,
          );
          // const publicacao =
          //   this.arquivoPublicacaoService.generateRemessaDTO(itemTransacao);
          // await this.arquivoPublicacaoService.save(publicacao);
          if (!allItemDetalheAMap[headerLoteUniqueId]) {
            allItemDetalheAMap[headerLoteUniqueId] = [itemTransacao];
          } else {
            allItemDetalheAMap[headerLoteUniqueId].push(itemTransacao);
          }

          // DetalheB
          const detalheAUniqueid = DetalheA.getUniqueId(
            itemTransacao.detalheA as DetalheA,
          );
          const detalheB = this.getRemessaDetalheBDTO(detalhe);
          if (!allDetalheBMap[detalheAUniqueid]) {
            allDetalheBMap[detalheAUniqueid] = [detalheB];
          } else {
            allDetalheBMap[detalheAUniqueid].push(detalheB);
          }
        }
      }
    }
    return {
      /** Each cnab has only 1 Transacao. These are Transacao to update after success */
      allUpdatedTransacoes,
      /** Each cnab has only 1 HeaderArquivo */
      allHeaderArquivo,
      /** key: HeaderArquivo HeaderArquivo unique id */
      allHeaderLoteMap,
      /** key: HeaderLote unique ID */
      allItemDetalheAMap,
      /** key: HeaderLote + DetalheA nested unique ID */
      allDetalheBMap,
    };
  }

  /**
   * It will not contain `headerLote` field. You must add it later.
   */
  public getRemessaItemDetalheADTO(
    detalhes: CnabRemessaDetalhe,
    headerLote?: DeepPartial<HeaderLote>,
  ) {
    const r = detalhes.registroAB;
    const itemTransacao = detalhes.itemTransacao;
    const favorecido = itemTransacao.clienteFavorecido;

    const itemDetalheA = new ItemTransacaoDTO({
      id: itemTransacao.id,
      // DetalheA
      detalheA: {
        headerLote: headerLote || { id: -1 },
        clienteFavorecido: { id: favorecido.id },
        loteServico: r.detalheA.loteServico.convertedValue,
        finalidadeDOC: r.detalheA.finalidadeDOC.stringValue,
        numeroDocumentoEmpresa:
          r.detalheA.numeroDocumentoEmpresa.convertedValue,
        dataVencimento: r.detalheA.dataVencimento.convertedValue,
        tipoMoeda: r.detalheA.tipoMoeda.stringValue,
        quantidadeMoeda: r.detalheA.quantidadeMoeda.convertedValue,
        valorLancamento: r.detalheA.valorLancamento.convertedValue,
        numeroDocumentoBanco: r.detalheA.numeroDocumentoBanco.stringValue,
        quantidadeParcelas: r.detalheA.quantidadeParcelas.convertedValue,
        indicadorBloqueio: r.detalheA.indicadorBloqueio.stringValue,
        indicadorFormaParcelamento:
          r.detalheA.indicadorFormaParcelamento.stringValue,
        periodoVencimento: itemTransacao.dataProcessamento,
        numeroParcela: r.detalheA.numeroParcela.convertedValue,
        dataEfetivacao: r.detalheA.dataEfetivacao.convertedValue,
        valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
        nsr: Number(r.detalheA.nsr.stringValue),
        ocorrencias: null,
      },
    }) as ItemTransacao | ItemTransacaoAgrupado;
    return itemDetalheA;
  }

  /**
   * It will not contain `detalheA` field. You must add it later.
   */
  public getRemessaDetalheBDTO(detalhe: CnabRemessaDetalhe) {
    const itemTransacao = detalhe.itemTransacao;
    const r = detalhe.registroAB;
    const detalheB = new DetalheBDTO({
      dataVencimento: asDate(itemTransacao.dataProcessamento),
      nsr: Number(r.detalheB.nsr.value),
    });
    return detalheB;
  }

  // #endregion

  // #region generateRemessa

  /**
   * From Transacao generate:
   * - Stringified Cnab to be exported
   * - Cnab Tables DTO to be saved in database
   */
  public async generateCnabRemessa(
    transacao?: Transacao,
    transacaoAg?: TransacaoAgrupado,
  ): Promise<CnabRemessa | null> {
    const headerArquivo = await this.headerArquivoService.getDTO(
      HeaderArquivoTipoArquivo.Remessa,
      transacao,
      transacaoAg,
    );
    const headerLote = this.headerLoteService.getDTO(
      headerArquivo,
      transacao,
      transacaoAg,
    );

    // Get Cnab104 with Detalhes
    const cnab104 = await this.generateCnab104Pgto(
      headerArquivo,
      headerLote,
      transacao,
      transacaoAg,
    );
    if (!cnab104) {
      return null;
    }

    // read file104
    const [cnabString, processedCnab104] = stringifyCnab104File(
      cnab104.cnab104,
      true,
      'CnabPgtoRem',
    );

    // Mount cnabTablesDTO
    const cnabTables = this.generateCnabTables(
      headerArquivo,
      headerLote,
      processedCnab104,
      cnab104.itemTransacaoList,
      transacao,
      transacaoAg,
    );
    return {
      string: cnabString,
      dto: cnabTables,
    };
  }

  /**
   * Mount Cnab104 from tables
   */
  private async generateCnab104Pgto(
    headerArquivo: HeaderArquivoDTO,
    headerLote: HeaderLote,
    transacao?: Transacao,
    transacaoAg?: TransacaoAgrupado,
  ): Promise<{
    cnab104: CnabFile104Pgto;
    itemTransacaoList: ItemTransacao[] | ItemTransacaoAgrupado[];
  } | null> {
    const now = new Date();
    const headerArquivo104 = this.getHeaderArquivo104FromDTO(headerArquivo);
    const trailerArquivo104 = sc(PgtoRegistros.trailerArquivo);
    const itemTransacaoMany = transacao
      ? await this.itemTransacaoService.findManyByIdTransacao(transacao.id)
      : await this.itemTransacaoAgService.findManyByIdTransacao(
          (transacaoAg as TransacaoAgrupado).id,
        );

    let numeroDocumento = await this.detalheAService.getNextNumeroDocumento(
      now,
    );

    // Mount file104

    const cnab104: CnabFile104Pgto = {
      headerArquivo: headerArquivo104,
      lotes: [
        {
          headerLote: this.getHeaderLoteFrom104(headerLote),
          registros: [],
          trailerLote: sc(PgtoRegistros.trailerLote),
        },
      ],
      trailerArquivo: trailerArquivo104,
    };

    const itemTransacaoSuccess: ItemTransacao[] | ItemTransacaoAgrupado[] = [];
    for (const itemTransacao of itemTransacaoMany) {
      // add valid itemTransacao
      const successDetalhes = await this.getDetalhes104(
        itemTransacao,
        numeroDocumento,
      );
      if (successDetalhes) {
        cnab104.lotes[0].registros.push(successDetalhes);
        itemTransacaoSuccess.push(itemTransacao as any);
      }
      numeroDocumento++;
    }
    // Remove empty cnab104 lotes
    cnab104.lotes = cnab104.lotes.filter((l) => l.registros.length > 0);
    // If empty, return null
    if (!cnab104.lotes.length) {
      return null;
    }

    return {
      cnab104: cnab104,
      itemTransacaoList: itemTransacaoSuccess,
    };
  }

  private getHeaderArquivo104FromDTO(
    headerArquivoDTO: HeaderArquivoDTO,
  ): CnabHeaderArquivo104 {
    const headerArquivo104: CnabHeaderArquivo104 = sc(
      PgtoRegistros.headerArquivo,
    );
    headerArquivo104.codigoBanco.value = headerArquivoDTO.codigoBanco;
    headerArquivo104.numeroInscricao.value = headerArquivoDTO.numeroInscricao;
    headerArquivo104.codigoConvenioBanco.value =
      headerArquivoDTO.codigoConvenio;
    headerArquivo104.parametroTransmissao.value =
      headerArquivoDTO.parametroTransmissao;
    headerArquivo104.agenciaContaCorrente.value = headerArquivoDTO.agencia;
    headerArquivo104.numeroConta.value = headerArquivoDTO.numeroConta;
    headerArquivo104.dvAgencia.value = headerArquivoDTO.dvAgencia;
    headerArquivo104.dvConta.value = headerArquivoDTO.dvConta;
    headerArquivo104.nomeEmpresa.value = headerArquivoDTO.nomeEmpresa;
    headerArquivo104.tipoArquivo.value = headerArquivoDTO.tipoArquivo;
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dataGeracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.horaGeracao;
    headerArquivo104.nsa.value = headerArquivoDTO.nsa;

    return headerArquivo104;
  }

  /**
   * A pipe to generate CnabTables
   */
  private generateCnabTables(
    headerArquivo: HeaderArquivoDTO,
    headerLote: HeaderLote,
    processedCnab104: CnabFile104Pgto,
    itemTransacaoList: ItemTransacao[] | ItemTransacaoAgrupado[],
    transacao?: Transacao,
    transacaoAg?: TransacaoAgrupado,
  ): CnabRemessaDTO {
    if (processedCnab104.lotes.length > 1) {
      throw CommonHttpException.details(
        'Este método só gera tabelas para CNABs com 1 lote. ' +
          `Recebeu ${processedCnab104.lotes.length}`,
      );
    }
    this.updateHeaderArquivoDTOFrom104(
      headerArquivo,
      processedCnab104.headerArquivo,
    );
    this.updateHeaderLoteDTOFrom104(
      headerLote,
      processedCnab104.lotes[0].headerLote,
    );
    const isAgrupado = transacaoAg !== undefined;
    const cnabTables: CnabRemessaDTO = {
      transacao: isAgrupado
        ? (transacaoAg as TransacaoAgrupado)
        : (transacao as Transacao),
      headerArquivo: headerArquivo,
      lotes: [
        {
          headerLote: headerLote,
          detalhes: [],
        },
      ],
    };

    // Mount cnabTablesDTO detalhes
    for (let i = 0; i < itemTransacaoList.length; i++) {
      const itemTransacao = itemTransacaoList[i];
      cnabTables.lotes[0].detalhes.push({
        itemTransacao: itemTransacao,
        registroAB: processedCnab104.lotes[0].registros[
          i
        ] as CnabRegistros104Pgto,
      });
    }

    // Remove empty cnabTables lotes
    cnabTables.lotes = cnabTables.lotes.filter((l) => l.detalhes.length > 0);

    return cnabTables;
  }

  private updateHeaderArquivoDTOFrom104(
    headerArquivoDTO: HeaderArquivoDTO,
    headerArquivo104: CnabHeaderArquivo104,
  ) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
  }

  private updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLote,
    headerLote104: CnabHeaderLote104Pgto,
  ) {
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
  }

  private getHeaderLoteFrom104(
    headerLoteDTO: HeaderLote,
  ): CnabHeaderLote104Pgto {
    const headerLote104: CnabHeaderLote104Pgto = sc(PgtoRegistros.headerLote);
    const headerArquivo = headerLoteDTO.headerArquivo as HeaderArquivo;
    const pagador = headerLoteDTO.pagador;
    headerLote104.codigoConvenioBanco.value = headerLoteDTO.codigoConvenioBanco;
    headerLote104.numeroInscricao.value = headerLoteDTO.numeroInscricao;
    headerLote104.parametroTransmissao.value =
      headerLoteDTO.parametroTransmissao;
    headerLote104.tipoInscricao.value = headerLoteDTO.tipoInscricao;
    // Pagador
    headerLote104.agenciaContaCorrente.value = headerArquivo.agencia;
    headerLote104.dvAgencia.value = headerArquivo.dvAgencia;
    headerLote104.numeroConta.value = headerArquivo.numeroConta;
    headerLote104.dvConta.value = headerArquivo.dvConta;
    headerLote104.nomeEmpresa.value = headerArquivo.nomeEmpresa;
    // Pagador addresss
    headerLote104.logradouro.value = pagador.logradouro;
    headerLote104.numeroLocal.value = pagador.numero;
    headerLote104.complemento.value = pagador.complemento;
    headerLote104.cidade.value = pagador.cidade;
    headerLote104.cep.value = pagador.cep;
    headerLote104.complementoCep.value = pagador.complementoCep;
    headerLote104.siglaEstado.value = pagador.uf;

    return headerLote104;
  }

  /**
   * Get Cnab Detalhes A,B.
   *
   * If ItemTransacao is not valid yet, status = `fail`.
   *
   * indicadorBloqueio = DataFixa (see `detalheATemplate`)
   *
   * @param numeroDocumento Managed by company. It must be a new number.
   * @returns null if failed ItemTransacao to CNAB */
  public async getDetalhes104(
    itemTransacao: ItemTransacao | ItemTransacaoAgrupado,
    numeroDocumento: number,
  ): Promise<CnabRegistros104Pgto | null> {
    const METHOD = 'getDetalhes104()';
    const favorecido = itemTransacao.clienteFavorecido;
    if (!favorecido) {
      // Failure if no favorecido
      await this.itemTransacaoService.save({
        id: itemTransacao.id,
        status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.failure),
      });
      this.logger.debug(
        `Falha ao usar ItemTransacao #${itemTransacao.id}: favorecido ausente.`,
        METHOD,
      );
      return null;
    }

    const detalheA: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
    detalheA.codigoBancoDestino.value = favorecido.codigoBanco;
    detalheA.codigoAgenciaDestino.value = favorecido.agencia;
    detalheA.dvAgenciaDestino.value = favorecido.dvAgencia;
    detalheA.contaCorrenteDestino.value = favorecido.contaCorrente;
    detalheA.dvContaDestino.value = favorecido.dvContaCorrente;
    detalheA.nomeTerceiro.value = favorecido.nome;
    detalheA.numeroDocumentoEmpresa.value = numeroDocumento;
    detalheA.dataVencimento.value = itemTransacao.dataProcessamento;
    // indicadorFormaParcelamento = DataFixa
    detalheA.valorLancamento.value = itemTransacao.valor;

    const detalheB: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
    detalheB.tipoInscricao.value = getTipoInscricao(
      asString(favorecido.cpfCnpj),
    );
    detalheB.numeroInscricao.value = asString(favorecido.cpfCnpj);
    detalheB.dataVencimento.value = detalheA.dataVencimento.value;
    // Favorecido address
    detalheB.logradouro.value = favorecido.logradouro;
    detalheB.numeroLocal.value = favorecido.numero;
    detalheB.complemento.value = favorecido.complemento;
    detalheB.bairro.value = favorecido.bairro;
    detalheB.cidade.value = favorecido.cidade;
    detalheB.cep.value = favorecido.cep;
    detalheB.complementoCep.value = favorecido.complementoCep;
    detalheB.siglaEstado.value = favorecido.uf;

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  // #endregion

  /**
   * This task will:
   * 1. Get existing corresponding Remessa to use as base
   * 2. For each Registro in Retorno save it in each CNAB Table
   *
   * @throws `HttpException` if any sub task fails
   *
   * @returns `true` if new Retorno has been created.
   *
   * `false` if retorno already exists.
   */
  public async saveRetorno(cnab: CnabFile104Pgto) {
    const METHOD = 'saveRetorno()';
    // Save HeaderArquivo
    const headerArquivoRem = await this.headerArquivoService.getOne({
      nsa: Number(cnab.headerArquivo.nsa.value),
      tipoArquivo: HeaderArquivoTipoArquivo.Remessa,
    });

    const headerArquivoRetSave = await this.headerArquivoService.saveRetFrom104(
      cnab,
      headerArquivoRem,
    );
    if (!headerArquivoRetSave.isNewItem) {
      this.logger.warn(
        `Retorno HeaderArquivo Retorno ${headerArquivoRetSave.item.getIdString()} já existe no banco, ignorando...`,
        METHOD,
      );
      return null;
    }

    for (const l of cnab.lotes) {
      // Save HeaderLote
      const headerLoteSave = await this.headerLoteService.saveFrom104(
        l,
        headerArquivoRetSave.item,
      );

      for (const registro of l.registros) {
        // Save Detalhes
        const detalheASave = await this.detalheAService.saveFrom104(
          registro,
          headerLoteSave.item,
        );
        await this.detalheBService.saveFrom104(registro, detalheASave.item);
      }
    }

    // Update status
    const headerArquivoRemUpdated = await this.headerArquivoService.save({
      id: headerArquivoRem.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.retornoSaved),
    });
    const headerArquivoRetUpdated = await this.headerArquivoService.save({
      id: headerArquivoRetSave.item.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.retornoSaved),
    });

    return {
      remessa: headerArquivoRemUpdated,
      retorno: headerArquivoRetUpdated,
    };
  }
}
