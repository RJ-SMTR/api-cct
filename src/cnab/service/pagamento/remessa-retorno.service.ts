import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';

import { Injectable, NotFoundException } from '@nestjs/common';
import { endOfDay, isFriday, nextFriday, startOfDay, subDays } from 'date-fns';
import { DetalheADTO } from 'src/cnab/dto/pagamento/detalhe-a.dto';
import { HeaderLoteDTO } from 'src/cnab/dto/pagamento/header-lote.dto';
import { HeaderArquivoDTO } from './../../dto/pagamento/header-arquivo.dto';
import { Cnab104TipoMovimento } from './../../enums/104/cnab-104-tipo-movimento.enum';

import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheAConf } from 'src/cnab/entity/conference/detalhe-a-conf.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { Cnab104AmbienteCliente } from 'src/cnab/enums/104/cnab-104-ambiente-cliente.enum';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { CnabTrailerArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getCnabFieldConverted } from 'src/cnab/utils/cnab/cnab-field-utils';
import { LancamentoStatus } from 'src/lancamento/enums/lancamento-status.enum';
import { LancamentoService } from 'src/lancamento/lancamento.service';
import { TransacaoViewService } from 'src/transacao-view/transacao-view.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { Between, DataSource, DeepPartial, IsNull, Not, QueryRunner } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { CnabHeaderArquivo104, CnabHeaderArquivo104DTO } from '../../dto/cnab-240/104/cnab-header-arquivo-104.dto';
import { CnabDetalheA_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabHeaderLote104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { getTipoInscricao } from '../../utils/cnab/cnab-utils';
import { ArquivoPublicacaoService } from '../arquivo-publicacao.service';
import { OcorrenciaService } from '../ocorrencia.service';
import { DetalheAConfService } from './detalhe-a-conf.service';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBConfService } from './detalhe-b-conf.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderArquivoConfService } from './header-arquivo-conf.service';
import { HeaderArquivoService } from './header-arquivo.service';
import { HeaderLoteConfService } from './header-lote-conf.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { ItemTransacaoService } from './item-transacao.service';

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class RemessaRetornoService {
  private logger = new CustomLogger('CnabPagamentoService', {
    timestamp: true,
  });

  constructor(
    private arquivoPublicacaoService: ArquivoPublicacaoService, //
    private lancamentoService: LancamentoService,
    private detalheAConfService: DetalheAConfService,
    private detalheAService: DetalheAService,
    private detalheBConfService: DetalheBConfService,
    private detalheBService: DetalheBService,
    private headerArquivoConfService: HeaderArquivoConfService,
    private headerArquivoService: HeaderArquivoService,
    private headerLoteConfService: HeaderLoteConfService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    private ocorrenciaService: OcorrenciaService,
    private transacaoViewService: TransacaoViewService,
    private dataSource: DataSource,
  ) {}

  public async saveHeaderArquivoDTO(transacaoAg: TransacaoAgrupado, isConference: boolean, isTeste?: boolean): Promise<HeaderArquivoDTO> {
    let headerArquivoDTO: HeaderArquivoDTO;
    if (!isConference) {
      headerArquivoDTO = await this.headerArquivoService.newCreatedDTO(HeaderArquivoTipoArquivo.Remessa, transacaoAg, isTeste);
      const headerArquivo = await this.headerArquivoService.save(headerArquivoDTO);
      headerArquivoDTO.id = headerArquivo.id;
    } else {
      headerArquivoDTO = await this.headerArquivoConfService.newCreatedDto(HeaderArquivoTipoArquivo.Remessa, transacaoAg, isTeste);
      const headerArquivo = await this.headerArquivoConfService.save(headerArquivoDTO);
      headerArquivoDTO.id = headerArquivo.id;
    }
    return headerArquivoDTO;
  }

  /**
   * Cada lote é separado por:
   * - tipoCompromisso
   * - formaLancamento
   *
   * Regras:
   *
   * tipoCompromisso: fixo
   * formaLancamento:
   *  - se banco favorecido = Caixa, CreditoContaCorrente (01)
   *    (se banco do favorecido = banco do pagador - pagador é sempre Caixa)
   *  - senão, TED (41)
   */
  public async getLotes(pagador: Pagador, headerArquivoDTO: HeaderArquivoDTO, isConference: boolean, isTeste?: boolean, dataPgto?: Date) {
    const transacaoAg = headerArquivoDTO.transacaoAgrupado as TransacaoAgrupado;
    const itemTransacaoAgs = await this.itemTransacaoAgService.findManyByIdTransacaoAg(transacaoAg.id);

    // Agrupar por Lotes
    /** Agrupa por: formaLancamento */
    const lotes: HeaderLoteDTO[] = [];
    let nsrTed = 0;
    let nsrCC = 0;
    /** @type HeaderLoteDTO */
    let loteTed: any;
    /** @type HeaderLoteDTO */
    let loteCC: any;
    for (const itemTransacaoAgrupado of itemTransacaoAgs) {
      const itemTransacao = await this.itemTransacaoService.findOne({
        where: {
          itemTransacaoAgrupado: { id: itemTransacaoAgrupado.id },
        },
      });
      if (itemTransacao) {
        //TED
        if (itemTransacao.clienteFavorecido.codigoBanco !== '104') {
          nsrTed++;
          if (loteTed == undefined) {
            if (!isConference) {
              loteTed = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.TED, isTeste);
              loteTed = await this.headerLoteService.saveDto(loteTed);
            } else {
              loteTed = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.TED, isTeste);
              loteTed = await this.headerLoteConfService.saveDto(loteTed);
            }
          }
          const detalhes104 = await this.saveListDetalhes(loteTed, [itemTransacaoAgrupado], nsrTed, isConference, dataPgto);
          nsrTed++;
          loteTed.registros104.push(...detalhes104);
        }
        //Credito em Conta
        else {
          nsrCC++;
          // Atual
          if (loteCC == undefined) {
            if (!isConference) {
              loteCC = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.CreditoContaCorrente, isTeste);
              loteCC = await this.headerLoteService.saveDto(loteCC);
            } else {
              loteCC = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.CreditoContaCorrente, isTeste);
              loteCC = await this.headerLoteConfService.saveDto(loteCC);
            }
          }
          const detalhes104 = await this.saveListDetalhes(loteCC, [itemTransacaoAgrupado], nsrCC, isConference, dataPgto);
          nsrCC++;
          loteCC.registros104.push(...detalhes104);
        }
      }
    }
    // Adicionar lote
    if (loteTed != undefined) {
      lotes.push(loteTed);
    }
    if (loteCC != undefined) {
      lotes.push(loteCC);
    }
    return lotes;
  }

  async convertCnabDetalheAToDTO(detalheA: CnabDetalheA_104, headerLoteId: number, itemTransacaoAg: ItemTransacaoAgrupado, isConference: boolean) {
    let existing: DetalheA | DetalheAConf | null = null;
    if (!isConference) {
      existing = await this.detalheAService.findOne({
        where: {
          nsr: Number(detalheA.nsr.value),
          itemTransacaoAgrupado: { id: itemTransacaoAg?.id },
        },
      });
    } else {
      existing = await this.detalheAConfService.findOne({
        where: {
          nsr: Number(detalheA.nsr.value),
          itemTransacaoAgrupado: { id: itemTransacaoAg?.id },
        },
      });
    }
    return DetalheADTO.fromRetorno(detalheA, existing, headerLoteId, itemTransacaoAg);
  }

  async convertCnabDetalheBToDTO(detalheB: CnabDetalheB_104, detalheAId: number) {
    const existing = await this.detalheBService.findOne({
      detalheA: { id: detalheAId },
    });
    return new DetalheBDTO({
      ...(existing ? { id: existing.id } : {}),
      nsr: detalheB.nsr.value,
      detalheA: { id: detalheAId },
      dataVencimento: startOfDay(getCnabFieldConverted(detalheB.dataVencimento)),
    });
  }

  /**
   * Salva no banco e gera Detalhes104 para o lote
   *
   * Para cada ItemTransacaoAg:
   * - Salva no banco
   * - Gera Detalhes104
   *
   * @returns Detalhes104 gerados a partir dos ItemTransacaoAg
   */
  async saveListDetalhes(headerLoteDto: HeaderLoteDTO, itemTransacoes: ItemTransacaoAgrupado[], nsr: number, isConference: boolean, dataPgto?: Date): Promise<CnabRegistros104Pgto[]> {
    let numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());
    // Para cada itemTransacao, cria detalhe
    const detalhes: CnabRegistros104Pgto[] = [];
    let itemTransacaoAgAux: ItemTransacaoAgrupado | undefined;
    for (const itemTransacao of itemTransacoes) {
      itemTransacaoAgAux = itemTransacao as ItemTransacaoAgrupado;
      const detalhe = await this.saveDetalhes104(numeroDocumento, headerLoteDto, itemTransacaoAgAux, nsr, isConference, dataPgto);
      if (detalhe) {
        detalhes.push(detalhe);
      }
      numeroDocumento++;
    }
    return detalhes;
  }

  public async updateHeaderArquivoDTOFrom104(headerArquivoDTO: HeaderArquivoDTO, headerArquivo104: CnabHeaderArquivo104) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
    await this.headerArquivoService.save(headerArquivoDTO);
  }

  public async updateHeaderLoteDTOFrom104(headerLoteDTO: HeaderLoteDTO, headerLote104: CnabHeaderLote104Pgto, isConference: boolean) {
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
    if (!isConference) {
      await this.headerLoteService.save(headerLoteDTO);
    } else {
      await this.headerLoteConfService.save(headerLoteDTO);
    }
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
   * @param numeroDocumento Gerenciado pela empresa. Deve ser um número único.
   * @param dataPgto O padrão é o dia de hoje. O valor será sempre >= hoje.
   * @returns null if failed ItemTransacao to CNAB */
  public async saveDetalhes104(numeroDocumento: number, headerLote: HeaderLoteDTO, itemTransacaoAg: ItemTransacaoAgrupado, nsr: number, isConference: boolean, dataPgto?: Date, isCancelamento = false, detalheAC = new DetalheA()): Promise<CnabRegistros104Pgto | null> {
    /** @type ClienteFavorecido */
    let favorecido: ClienteFavorecido | undefined;
    if (itemTransacaoAg != undefined) {
      const itemTransacao = await this.itemTransacaoService.findOne({ where: { itemTransacaoAgrupado: { id: itemTransacaoAg.id } } });
      favorecido = itemTransacao?.clienteFavorecido;
    } else {
      const itemTransacaoAg = detalheAC.headerLote.headerArquivo.transacaoAgrupado?.itemTransacoesAgrupado[0];
      const itemTransacao = await this.itemTransacaoService.findOne({ where: { itemTransacaoAgrupado: { id: itemTransacaoAg?.id } } });
      favorecido = itemTransacao?.clienteFavorecido;
    }

    // Failure if no favorecido
    if (!favorecido) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.startTransaction();
        await this.itemTransacaoService.save({ id: itemTransacaoAg.id }, queryRunner);
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Falha ao salvar Informções agrupadas`, error?.stack);
      } finally {
        await queryRunner.release();
      }
      return null;
    }

    let _dataPgto = dataPgto || itemTransacaoAg.dataOrdem;
    if (_dataPgto < new Date()) {
      _dataPgto = new Date();
    }

    // Save detalheA
    const detalheA: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
    detalheA.codigoBancoDestino.value = favorecido.codigoBanco;
    detalheA.codigoAgenciaDestino.value = favorecido.agencia;
    detalheA.dvAgenciaDestino.value = favorecido.dvAgencia;
    detalheA.contaCorrenteDestino.value = favorecido.contaCorrente;
    detalheA.dvContaDestino.value = favorecido.dvContaCorrente;
    detalheA.nomeTerceiro.value = favorecido.nome;
    detalheA.numeroDocumentoEmpresa.value = numeroDocumento;
    detalheA.dataVencimento.value = _dataPgto;

    if (!isCancelamento) {
      detalheA.valorLancamento.value = itemTransacaoAg.valor;
    } else {
      detalheA.valorLancamento.value = detalheAC.valorLancamento;
    }

    detalheA.nsr.value = nsr;

    // DetalheB
    const detalheB: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
    detalheB.tipoInscricao.value = getTipoInscricao(asString(favorecido.cpfCnpj));
    detalheB.numeroInscricao.value = asString(favorecido.cpfCnpj);
    if (dataPgto == undefined) {
      detalheB.dataVencimento.value = detalheA.dataVencimento.value;
    } else {
      detalheB.dataVencimento.value = dataPgto;
    }
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

    if (!isCancelamento) {
      const savedDetalheA = await this.saveDetalheA(detalheA, asNumber(headerLote.id), itemTransacaoAg, isConference);
      await this.saveDetalheB(detalheB, savedDetalheA.id, isConference);
    }

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  async saveDetalheA(detalheA104: CnabDetalheA_104, savedHeaderLoteId: number, itemTransacaoAg: ItemTransacaoAgrupado, isConference: boolean) {
    const detalheADTO = await this.convertCnabDetalheAToDTO(detalheA104, savedHeaderLoteId, itemTransacaoAg, isConference);
    if (!isConference) {
      const saved = await this.detalheAService.save(detalheADTO);
      return await this.detalheAService.getOne({ id: saved.id });
    } else {
      const saved = await this.detalheAConfService.save(detalheADTO);
      return await this.detalheAConfService.getOne({ id: saved.id });
    }
  }

  async saveDetalheB(detalheB104: CnabDetalheB_104, savedDetalheAId: number, isConference: boolean) {
    const detalheBDTO = await this.convertCnabDetalheBToDTO(detalheB104, savedDetalheAId);
    if (!isConference) {
      await this.detalheBService.save(detalheBDTO);
    } else {
      await this.detalheBConfService.save(detalheBDTO);
    }
  }

  public async saveRetornoPagamento(cnab: CnabFile104Pgto, retornoName: string) {
    const detalhesANaoEncontrados: any[] = [];
    const dataEfetivacao = new Date();
    let detalheAUpdated: DetalheA | null = null;
    for (const cnabLote of cnab.lotes) {
      for (const registro of cnabLote.registros) {
        const logRegistro = `HeaderArquivo: ${cnab.headerArquivo.nsa.convertedValue}, lote: ${cnabLote.headerLote.codigoRegistro.value}`;

        // Save Detalhes
        const detalheASaveResult = await this.detalheAService.saveRetornoFrom104(cnab.headerArquivo, cnabLote.headerLote, registro, dataEfetivacao, retornoName);
        if (typeof detalheASaveResult === 'string') {
          if (detalheASaveResult === 'detalheANotFound') {
            const numeroDocumento = registro.detalheA.numeroDocumentoEmpresa.convertedValue;
            detalhesANaoEncontrados.push(numeroDocumento);
          }
          continue;
        }
        detalheAUpdated = detalheASaveResult;
        this.logger.debug(logRegistro + ` Detalhe A Documento: ${detalheAUpdated.numeroDocumentoEmpresa}, favorecido: '${registro.detalheA.nomeTerceiro.value.trim()}' - OK`);

        await this.detalheBService.saveFrom104(registro, detalheAUpdated);
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
          await queryRunner.startTransaction();
          await this.compareRemessaToRetorno(detalheAUpdated, queryRunner);
          await queryRunner.commitTransaction();
        } catch (error) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`Falha ao salvar Informções retorno`, error?.stack);
        } finally {
          await queryRunner.release();
        }
        await this.detalheAService.updateDetalheAStatus(detalheAUpdated);
      }
    }

    if (detalhesANaoEncontrados.length > 0) {
      throw new NotFoundException(`Os seguintes DetalhesA do Retorno não foram encontrados no Banco (campo: no. documento) - ${detalhesANaoEncontrados.join(',')}`);
    }
  }

  // region compareRemessaToRetorno

  /**
   * Após salvar retorno, atualiza ocorrências e publicacoes
   */
  public async compareRemessaToRetorno(detalheA: DetalheA, queryRunner: QueryRunner): Promise<void> {
    await this.saveOcorrenciasDetalheA(detalheA, queryRunner);
    await this.saveRetornoPublicacao(detalheA, queryRunner);
    // await this.saveRetornoLancamento(detalheA, queryRunner);
  }

  async saveOcorrenciasDetalheA(detalheARetorno: DetalheA, queryRunner: QueryRunner) {
    if (!detalheARetorno.ocorrenciasCnab) {
      return;
    }
    const ocorrencias = Ocorrencia.fromCodesString(detalheARetorno.ocorrenciasCnab);
    // Update
    await this.ocorrenciaService.delete(detalheARetorno, queryRunner);

    for (const ocorrencia of ocorrencias) {
      ocorrencia.detalheA = detalheARetorno;
    }
    if (ocorrencias.length === 0) {
      return;
    }
    await this.ocorrenciaService.saveMany(ocorrencias, queryRunner);
  }

  /** Se o retorno for de Publicacao, atualiza */
  async saveRetornoPublicacao(detalheARetorno: DetalheA, queryRunner: QueryRunner) {
    const publicacoes = await this.arquivoPublicacaoService.findManyRaw({
      itemTransacaoAgrupadoId: [detalheARetorno.itemTransacaoAgrupado.id],
    });
    for (const publicacao of publicacoes) {
      publicacao.isPago = detalheARetorno.isPago();
      if (publicacao.isPago) {
        publicacao.valorRealEfetivado = publicacao.itemTransacao.valor;
        publicacao.dataEfetivacao = detalheARetorno.dataEfetivacao;
      } else {
        publicacao.valorRealEfetivado = null;
        publicacao.dataEfetivacao = null;
      }
      publicacao.dataGeracaoRetorno = detalheARetorno.headerLote.headerArquivo.dataGeracao;
    }
    await this.arquivoPublicacaoService.updateManyRaw(publicacoes, 'savePublicacaoRetorno', queryRunner);
  }

  /** Se o retorno for de Lancamento, atualiza */
  async saveRetornoLancamento(detalheARetorno: DetalheA, queryRunner: QueryRunner) {
    const lancamentos = await this.lancamentoService.find({ detalheA: { id: [detalheARetorno.id] } });
    for (const lancamento of lancamentos) {
      lancamento.is_pago = detalheARetorno.isPago();
      if (lancamento.is_pago) {
        lancamento.data_pgto = detalheARetorno.dataEfetivacao;
        lancamento.status = LancamentoStatus._5_pago;
      } else {
        lancamento.data_pgto = null;
        lancamento.status = LancamentoStatus._6_erro;
      }
    }
    await this.lancamentoService.updateManyRaw(lancamentos, ['is_pago', 'data_pgto', 'status'], queryRunner);
  }

  async compareTransacaoViewPublicacao(detalheA: DetalheA, queryRunner: QueryRunner) {
    const transacoesView = await this.getTransacoesViewWeek(subDays(detalheA.dataVencimento, 8), detalheA.dataVencimento);
    const publicacoesDetalhe = await this.arquivoPublicacaoService.getPublicacoesWeek(detalheA);
    const publicacoes = ArquivoPublicacao.getUniqueUpdatePublicacoes(publicacoesDetalhe);
    for (const publicacao of publicacoes) {
      const transacoes = transacoesView.filter((transacaoView) => transacaoView.itemTransacaoAgrupadoId === publicacao.itemTransacao.itemTransacaoAgrupado.id);
      if (transacoes.length > 0) {
        const updateTransacoes = transacoes.map((i) => ({ ...i, arquivoPublicacao: { id: publicacao.id } }));
        await this.transacaoViewService.saveMany(updateTransacoes, queryRunner);
      }
    }
  }

  async getTransacoesViewWeek(dataInicio: Date, dataFim: Date) {
    let friday = new Date();
    let startDate: Date;
    let endDate: Date;

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
    return await this.transacaoViewService.find(
      {
        datetimeTransacao: Between(startDate, endDate),
        itemTransacaoAgrupadoId: Not(IsNull()),
      },
      false,
    );
  }

  // endregion
}
