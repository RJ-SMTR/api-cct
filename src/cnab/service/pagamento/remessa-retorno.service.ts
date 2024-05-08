import { Injectable, Logger } from '@nestjs/common';
import { DetalheADTO } from 'src/cnab/dto/pagamento/detalhe-a.dto';
import { HeaderLoteDTO } from 'src/cnab/dto/pagamento/header-lote.dto';
import { ItemTransacaoDTO } from 'src/cnab/dto/pagamento/item-transacao.dto';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { CnabTrailerArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getCnabFieldConverted } from 'src/cnab/utils/cnab/cnab-field-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { asDate, asString } from 'src/utils/pipe-utils';
import { DeepPartial } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { ItemTransacaoStatus } from '../../entity/pagamento/item-transacao-status.entity';
import { ItemTransacao } from '../../entity/pagamento/item-transacao.entity';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { ItemTransacaoStatusEnum } from '../../enums/pagamento/item-transacao-status.enum';
import { CnabHeaderArquivo104 } from '../../interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabDetalheA_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabHeaderLote104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { CnabRemessaDetalhe } from '../../interfaces/cnab-all/cnab-remsesa.interface';
import { stringifyCnab104File } from '../../utils/cnab/cnab-104-utils';
import { getTipoInscricao } from '../../utils/cnab/cnab-utils';
import { ArquivoPublicacaoService } from '../arquivo-publicacao.service';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderArquivoService } from './header-arquivo.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { ItemTransacaoService } from './item-transacao.service';
import { TransacaoService } from './transacao.service';

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
        ocorrenciasCnab: null,
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
  ): Promise<string | null> {
    // Get headerArquivo
    const headerArquivoDTO = await this.headerArquivoService.getDTO(
      HeaderArquivoTipoArquivo.Remessa,
      transacao,
      transacaoAg,
    );

    // saveHeaderArquivo
    await this.saveHeaderArquivo(headerArquivoDTO);

    const pagador = transacao?.pagador || (transacaoAg?.pagador as Pagador);
    const headerLoteDTO = this.headerLoteService.getDTO(
      headerArquivoDTO,
      pagador,
    );
    const savedHeaderLote = await this.saveHeaderLoteDTO(headerLoteDTO);
    const detalhes = await this.getListDetalhes(
      savedHeaderLote.id,
      transacao,
      transacaoAg,
    );

    // Generate Cnab
    const cnab104 = this.generateCnab104Pgto(
      headerArquivoDTO,
      headerLoteDTO,
      detalhes,
    );

    if (!cnab104) {
      return null;
    }

    // Process cnab
    const [cnabString, processedCnab104] = stringifyCnab104File(
      cnab104,
      true,
      'CnabPgtoRem',
    );

    // Update
    await this.updateHeaderArquivoDTOFrom104(
      headerArquivoDTO,
      processedCnab104.headerArquivo,
    );
    await this.updateHeaderLoteDTOFrom104(
      headerLoteDTO,
      processedCnab104.lotes[0].headerLote,
    );

    return cnabString;
  }

  convertCnabDetalheAToDTO(
    detalheA: CnabDetalheA_104,
    headerLoteId: number,
    itemTransacao?: ItemTransacao,
    itemTransacaoAg?: ItemTransacaoAgrupado,
  ) {
    const favorecidoId = (itemTransacao || itemTransacaoAg)?.clienteFavorecido
      .id as number;
    return new DetalheADTO({
      nsr: Number(detalheA.nsr.value),
      ocorrenciasCnab: detalheA.ocorrencias.value.trim(),
      dataVencimento: getCnabFieldConverted(detalheA.dataVencimento),
      tipoMoeda: detalheA.tipoMoeda.value,
      finalidadeDOC: detalheA.finalidadeDOC.value,
      indicadorBloqueio: detalheA.indicadorBloqueio.value,
      numeroDocumentoBanco: detalheA.numeroDocumentoBanco.value,
      quantidadeParcelas: Number(detalheA.quantidadeParcelas.value),
      numeroDocumentoEmpresa: Number(detalheA.numeroDocumentoEmpresa.value),
      quantidadeMoeda: Number(detalheA.quantidadeMoeda.value),
      valorLancamento: getCnabFieldConverted(detalheA.valorLancamento),
      valorRealEfetivado: getCnabFieldConverted(detalheA.valorRealEfetivado),
      periodoVencimento: detalheA.dataVencimento.convertedValue,
      loteServico: getCnabFieldConverted(detalheA.loteServico),
      indicadorFormaParcelamento: getCnabFieldConverted(
        detalheA.indicadorFormaParcelamento,
      ),
      numeroParcela: getCnabFieldConverted(detalheA.numeroParcela),
      dataEfetivacao: getCnabFieldConverted(detalheA.dataEfetivacao),
      headerLote: { id: headerLoteId },
      itemTransacaoAgrupado: itemTransacaoAg,
      itemTransacao: itemTransacao,
      clienteFavorecido: { id: favorecidoId },
    });
  }

  convertCnabDetalheBToDTO(detalheB: CnabDetalheB_104, detalheAId: number) {
    return new DetalheBDTO({
      nsr: detalheB.nsr.value,
      detalheA: { id: detalheAId },
      dataVencimento: getCnabFieldConverted(detalheB.dataVencimento),
    });
  }

  async saveHeaderArquivo(headerArquivo: HeaderArquivoDTO) {
    await this.headerArquivoService.save(headerArquivo);
  }

  async saveHeaderLoteDTO(headerLote: HeaderLoteDTO) {
    return await this.headerLoteService.save(headerLote);
  }

  /**
   * Mount Cnab104 from tables
   */
  private generateCnab104Pgto(
    headerArquivo: HeaderArquivoDTO,
    headerLoteDTO: HeaderLoteDTO,
    detalhes: CnabRegistros104Pgto[],
  ) {
    const headerArquivo104 = this.getHeaderArquivo104FromDTO(headerArquivo);
    const trailerArquivo104 = sc(PgtoRegistros.trailerArquivo);

    // Mount file104
    const cnab104 = this.getCnabFilePgto(
      headerArquivo104,
      headerLoteDTO,
      detalhes,
      trailerArquivo104,
    );

    return cnab104;
  }

  /**
   * Save ItemTransacao, save Detalhes
   * Generate Detalhes
   */
  async getListDetalhes(
    headerLoteId: number,
    transacao?: Transacao,
    transacaoAg?: TransacaoAgrupado,
  ): Promise<CnabRegistros104Pgto[]> {
    let numeroDocumento = await this.detalheAService.getNextNumeroDocumento(
      new Date(),
    );

    // Obter item transacao de transacoes
    const itemTransacaoMany = transacao
      ? await this.itemTransacaoService.findManyByIdTransacao(transacao.id)
      : await this.itemTransacaoAgService.findManyByIdTransacao(
          (transacaoAg as TransacaoAgrupado).id,
        );
    const isTransacaoAgrupado = Boolean(transacaoAg);

    // Para cada itemTransacao, cria detalhe
    const detalhes: CnabRegistros104Pgto[] = [];
    let itemTransacaoAux: ItemTransacao | undefined;
    let itemTransacaoAgAux: ItemTransacaoAgrupado | undefined;
    let nsrAux = 0;
    for (const itemTransacao of itemTransacaoMany) {
      nsrAux += 1;
      // add valid itemTransacao
      if (isTransacaoAgrupado) {
        itemTransacaoAgAux = itemTransacao as ItemTransacaoAgrupado;
      } else {
        itemTransacaoAux = itemTransacao as ItemTransacao;
      }
      const detalhe = await this.saveGetDetalhes104(
        numeroDocumento,
        headerLoteId,
        nsrAux,
        itemTransacaoAux,
        itemTransacaoAgAux,
      );
      nsrAux += 1;
      if (detalhe) {
        detalhes.push(detalhe);

        // Save Detalhes
      }
      numeroDocumento++;
    }
    return detalhes;
  }

  getCnabFilePgto(
    headerArquivo104: CnabHeaderArquivo104,
    headerLoteDTO: HeaderLoteDTO,
    detalhes: CnabRegistros104Pgto[],
    trailerArquivo104: CnabTrailerArquivo104,
  ) {
    const cnab104: CnabFile104Pgto = {
      headerArquivo: headerArquivo104,
      lotes: [
        {
          headerLote: this.getHeaderLoteFrom104(headerLoteDTO),
          registros: detalhes,
          trailerLote: sc(PgtoRegistros.trailerLote),
        },
      ],
      trailerArquivo: trailerArquivo104,
    };
    cnab104.lotes = cnab104.lotes.filter((l) => l.registros.length > 0);
    if (!cnab104.lotes.length) {
      return null;
    }
    return cnab104;
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

  private async updateHeaderArquivoDTOFrom104(
    headerArquivoDTO: HeaderArquivoDTO,
    headerArquivo104: CnabHeaderArquivo104,
  ) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
    await this.headerArquivoService.save(headerArquivoDTO);
  }

  private async updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLoteDTO,
    headerLote104: CnabHeaderLote104Pgto,
  ) {
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
    await this.headerLoteService.save(headerLoteDTO);
  }

  // private async updateDetalhesDTOFrom104(detalhes104: CnabRegistros104Pgto) {
  //   headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
  //   await this.headerLoteService.save(headerLoteDTO);
  // }

  private getHeaderLoteFrom104(
    headerLoteDTO: HeaderLoteDTO,
  ): CnabHeaderLote104Pgto {
    const headerLote104: CnabHeaderLote104Pgto = sc(PgtoRegistros.headerLote);
    const headerArquivo = headerLoteDTO.headerArquivo as HeaderArquivo;
    const pagador = headerLoteDTO.pagador as DeepPartial<Pagador>;
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
   * Save Detalhes A, B.
   *
   * If ItemTransacao is not valid yet, status = `fail`.
   *
   * indicadorBloqueio = DataFixa (see `detalheATemplate`)
   *
   * @param numeroDocumento Managed by company. It must be a new number.
   * @returns null if failed ItemTransacao to CNAB */
  public async saveGetDetalhes104(
    numeroDocumento: number,
    headerLoteId: number,
    nsr: number,
    itemTransacao?: ItemTransacao,
    itemTransacaoAg?: ItemTransacaoAgrupado,
  ): Promise<CnabRegistros104Pgto | null> {
    const METHOD = 'getDetalhes104()';
    const favorecido = (itemTransacao || (itemTransacaoAg as any))
      .clienteFavorecido as ClienteFavorecido;

    // Failure if no favorecido
    if (!favorecido) {
      if (itemTransacao) {
        await this.itemTransacaoService.save({
          id: itemTransacao.id,
          status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.failure),
        });
      } else {
        await this.itemTransacaoService.save({
          id: (itemTransacaoAg as ItemTransacaoAgrupado).id,
          status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.failure),
        });
      }

      this.logger.debug(
        `Falha ao usar ItemTransacao: favorecido ausente.`,
        METHOD,
      );
      return null;
    }

    // Save detalheA
    const itemTransacaoAux = (itemTransacao ||
      itemTransacaoAg) as ItemTransacao;
    const detalheA: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
    detalheA.codigoBancoDestino.value = favorecido.codigoBanco;
    detalheA.codigoAgenciaDestino.value = favorecido.agencia;
    detalheA.dvAgenciaDestino.value = favorecido.dvAgencia;
    detalheA.contaCorrenteDestino.value = favorecido.contaCorrente;
    detalheA.dvContaDestino.value = favorecido.dvContaCorrente;
    detalheA.nomeTerceiro.value = favorecido.nome;
    detalheA.numeroDocumentoEmpresa.value = numeroDocumento;
    detalheA.dataVencimento.value = itemTransacaoAux.dataProcessamento;
    // indicadorFormaParcelamento = DataFixa
    detalheA.valorLancamento.value = itemTransacaoAux.valor;
    detalheA.nsr.value = nsr;

    const savedDetalheA = await this.saveDetalheA(
      detalheA,
      headerLoteId,
      itemTransacao,
      itemTransacaoAg,
    );

    // DetalheB
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
    detalheB.nsr.value = nsr + 1;

    await this.saveDetalheB(detalheB, savedDetalheA.id);

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  async saveDetalheA(
    detalheA104: CnabDetalheA_104,
    savedHeaderLoteId: number,
    itemTransacao?: ItemTransacao,
    itemTransacaoAg?: ItemTransacaoAgrupado,
  ) {
    const detalheADTO = this.convertCnabDetalheAToDTO(
      detalheA104,
      savedHeaderLoteId,
      itemTransacao,
      itemTransacaoAg,
    );
    return await this.detalheAService.save(detalheADTO);
  }

  async saveDetalheB(detalheB104: CnabDetalheB_104, savedDetalheAId: number) {
    const detalheBDTO = this.convertCnabDetalheBToDTO(
      detalheB104,
      savedDetalheAId,
    );
    await this.detalheBService.save(detalheBDTO);
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
    // Save HeaderArquivo
    const headerArquivoRem = await this.headerArquivoService.getOne({
      nsa: Number(cnab.headerArquivo.nsa.value),
      tipoArquivo: HeaderArquivoTipoArquivo.Remessa,
    });

    const headerArquivoUpdated = await this.headerArquivoService.saveRetFrom104(
      cnab,
      headerArquivoRem,
    );

    for (const cnabLote of cnab.lotes) {
      // Save HeaderLote
      const headerLoteSave = await this.headerLoteService.saveFrom104(
        cnabLote,
        headerArquivoUpdated,
      );

      for (const registro of cnabLote.registros) {
        // Save Detalhes
        const detalheASave = await this.detalheAService.saveRetornoFrom104(
          registro,
          headerLoteSave.item,
        );
        if (!detalheASave) {
          continue;
        }
        await this.detalheBService.saveFrom104(registro, detalheASave.item);
      }
    }

    // Update status
    const headerArquivoRemUpdated = await this.headerArquivoService.save({
      id: headerArquivoRem.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.retornoSaved),
    });
    const headerArquivoRetUpdated = await this.headerArquivoService.save({
      id: headerArquivoUpdated.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.retornoSaved),
    });

    return {
      remessa: headerArquivoRemUpdated,
      retorno: headerArquivoRetUpdated,
    };
  }
}
