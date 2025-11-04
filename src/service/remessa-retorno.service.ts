
import { Injectable, NotFoundException } from '@nestjs/common';
import { endOfDay, isFriday, nextFriday, startOfDay, subDays } from 'date-fns';

import { HeaderArquivoDTO } from '../domain/dto/header-arquivo.dto';


import { Cnab104FormaLancamento } from 'src/configuration/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { CnabFile104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/configuration/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getCnabFieldConverted } from 'src/configuration/cnab/utils/cnab/cnab-field-utils';

import { Between, DataSource, IsNull, Not, QueryRunner } from 'typeorm';
import { DetalheBDTO } from '../domain/dto/detalhe-b.dto';
import { HeaderArquivoTipoArquivo } from '../domain/enum/header-arquivo-tipo-arquivo.enum';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderArquivoService } from './header-arquivo.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { ItemTransacaoService } from './item-transacao.service';
import { ArquivoPublicacaoService } from './arquivo-publicacao.service';
import { OcorrenciaService } from './ocorrencia.service';
import { CnabHeaderArquivo104 } from 'src/configuration/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto';
import { CnabDetalheA_104 } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabHeaderLote104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { getTipoInscricao } from 'src/configuration/cnab/utils/cnab/cnab-utils';
import { DetalheADTO } from 'src/domain/dto/detalhe-a.dto';
import { HeaderLoteDTO } from 'src/domain/dto/header-lote.dto';
import { PagamentoIndevidoDTO } from 'src/domain/dto/pagamento-indevido.dto';
import { ArquivoPublicacao } from 'src/domain/entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { DetalheA } from 'src/domain/entity/detalhe-a.entity';
import { ItemTransacaoAgrupado } from 'src/domain/entity/item-transacao-agrupado.entity';
import { ItemTransacao } from 'src/domain/entity/item-transacao.entity';
import { Ocorrencia } from 'src/domain/entity/ocorrencia.entity';
import { Pagador } from 'src/domain/entity/pagador.entity';
import { TransacaoAgrupado } from 'src/domain/entity/transacao-agrupado.entity';
import { LancamentoStatus } from 'src/domain/enum/lancamento-status.enum';
import { CustomLogger } from 'src/utils/custom-logger';
import { asString, asNumber } from 'src/utils/pipe-utils';
import { LancamentoService } from './lancamento.service';
import { PagamentoIndevidoService } from './pgamento-indevido-service';
import { TransacaoViewService } from './transacao-view.service';

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
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,    
    private headerArquivoService: HeaderArquivoService,    
    private headerLoteService: HeaderLoteService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    private ocorrenciaService: OcorrenciaService,
    private transacaoViewService: TransacaoViewService,
    private dataSource: DataSource,
    private pagamentoIndevidoService: PagamentoIndevidoService
  ) { }

  public async saveHeaderArquivoDTO(transacaoAg: TransacaoAgrupado, isConference: boolean, isTeste?: boolean): Promise<HeaderArquivoDTO> {
    let headerArquivoDTO: HeaderArquivoDTO;    
      headerArquivoDTO = await this.headerArquivoService.newCreatedDTO(HeaderArquivoTipoArquivo.Remessa, transacaoAg, isTeste);
      const headerArquivo = await this.headerArquivoService.save(headerArquivoDTO);
      headerArquivoDTO.id = headerArquivo.id;    
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

    const lotes: HeaderLoteDTO[] = [];
    let nsrTed = 0;
    let nsrCC = 0;
    let loteTed: any;
    let loteCC: any;
    let valorAPagar: number | undefined;
    for (const itemTransacaoAgrupado of itemTransacaoAgs) {
      this.logger.debug('Operadora = ' + itemTransacaoAgrupado.nomeOperadora);
      valorAPagar = undefined;
      const itemTransacao = await this.itemTransacaoService.findOne({
        where: {
          itemTransacaoAgrupado: { id: itemTransacaoAgrupado.id },
        },
      });
      if (itemTransacao) {
        const pagamentoIndevido = await this.verificaPagamentoIndevido(itemTransacao);
        if (pagamentoIndevido) {
          valorAPagar = await this.debitarPagamentoIndevido(pagamentoIndevido, itemTransacaoAgrupado.valor);
        }

        //TED
        if (itemTransacao.clienteFavorecido.codigoBanco !== '104') {
          if ((valorAPagar !== undefined && valorAPagar > 0) || !pagamentoIndevido || isConference) {
            nsrTed++;
          }
          if (loteTed == undefined) {           
              loteTed = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.TED, isTeste);
              loteTed = await this.headerLoteService.saveDto(loteTed);          
          }
          const detalhes104 = await this.saveListDetalhes(valorAPagar, loteTed, itemTransacaoAgrupado, nsrTed, isConference, dataPgto);
          if (detalhes104[0].detalheA.nsr.value > 0) {
            nsrTed++;
            loteTed.registros104.push(...detalhes104);
          }
        }
        //Credito em Conta
        else {
          nsrCC++;
          // Atual
          if (loteCC == undefined) {           
              if ((valorAPagar !== undefined && valorAPagar > 0) || !pagamentoIndevido) {
                loteCC = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivoDTO, pagador, Cnab104FormaLancamento.CreditoContaCorrente, isTeste);
                loteCC = await this.headerLoteService.saveDto(loteCC);
              }           
          }
          const detalhes104 =
            await this.saveListDetalhes(valorAPagar, loteCC, itemTransacaoAgrupado, nsrCC, isConference, dataPgto);
          if (detalhes104[0].detalheA.nsr.value > 0) {
            nsrCC++;
            loteCC.registros104.push(...detalhes104);
          } else {
            nsrCC--;
          }
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

  async verificaPagamentoIndevido(itemTransacao: ItemTransacao) {
    if (itemTransacao.nomeConsorcio === 'STPC' || itemTransacao.nomeConsorcio === 'STPL') {
      const pagamentoIndevido = (await this.pagamentoIndevidoService.findAll())
        .filter(p => p.nomeFavorecido === itemTransacao.clienteFavorecido.nome);
      if (pagamentoIndevido && pagamentoIndevido[0] !== undefined
        && pagamentoIndevido[0].saldoDevedor !== undefined) {
        return pagamentoIndevido[0].saldoDevedor > 0 ? pagamentoIndevido[0] : undefined;
      } else {
        return undefined;
      }
    }
  }

  async debitarPagamentoIndevido(pagamentoIndevido: PagamentoIndevidoDTO, valor: any) {
    let aPagar = 0;      
    var arr = Number(valor).toFixed(2);
    let result = pagamentoIndevido.saldoDevedor - Number(arr);
    let resultArr = result.toFixed(2);
      result = Number(resultArr);
      if (result > 0) {
        //Vanzeiro continua devendo
        //Atualizar o banco com o debito restante  
        pagamentoIndevido.saldoDevedor = result;
        pagamentoIndevido.dataReferencia = new Date();
        await this.pagamentoIndevidoService.save(pagamentoIndevido);

      } else {
        //debito encerrado
        if (result <= 0) {
          //ex: result = -10          
          //pagar diferença para o vanzeiro
          aPagar = Math.abs(result);
          pagamentoIndevido.saldoDevedor = 0;
          pagamentoIndevido.dataReferencia = new Date();
          //deletar debito do vanzeiro
          await this.pagamentoIndevidoService.save(pagamentoIndevido);
        }
      }
    
    return aPagar;
  }

  async convertCnabDetalheAToDTO(detalheA: CnabDetalheA_104, headerLoteId: number, itemTransacaoAg: ItemTransacaoAgrupado) {
    let existing: DetalheA | null = null;
   
  existing = await this.detalheAService.findOne({
      where: {
        nsr: Number(detalheA.nsr.value),
        itemTransacaoAgrupado: { id: itemTransacaoAg?.id },
      },
    });
    
    return DetalheADTO.fromRemessa(detalheA, existing, headerLoteId, itemTransacaoAg);
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
  async saveListDetalhes(valorAPagar: number | undefined, headerLoteDto: HeaderLoteDTO,
    itemTransacao: ItemTransacaoAgrupado, nsr: number, isConference: boolean, dataPgto?: Date): Promise<CnabRegistros104Pgto[]> {
    let numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());
    // Para cada itemTransacao, cria detalhe
    const detalhes: CnabRegistros104Pgto[] = [];
    const detalhe = await this.saveDetalhes104(valorAPagar, numeroDocumento, headerLoteDto, itemTransacao, nsr, dataPgto);

    if (detalhe) {
      detalhes.push(detalhe);
    }
    numeroDocumento++;

    return detalhes;
  }

  public async updateHeaderArquivoDTOFrom104(headerArquivoDTO: HeaderArquivoDTO, headerArquivo104: CnabHeaderArquivo104) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
    await this.headerArquivoService.save(headerArquivoDTO);
  }

  public async updateHeaderLoteDTOFrom104(headerLoteDTO: HeaderLoteDTO, headerLote104: CnabHeaderLote104Pgto) {
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
      await this.headerLoteService.save(headerLoteDTO);
   
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
  public async saveDetalhes104(valorAPagar: number | undefined, numeroDocumento: number, headerLote: HeaderLoteDTO,
    itemTransacaoAg: ItemTransacaoAgrupado, nsr: number, dataPgto?: Date, isCancelamento = false, detalheADTO = new DetalheA()): Promise<CnabRegistros104Pgto | null> {
    /** @type ClienteFavorecido */
    let favorecido: ClienteFavorecido | undefined;
    if (itemTransacaoAg !== undefined) {
      const itemTransacao =
        await this.itemTransacaoService.findOne({ where: { itemTransacaoAgrupado: { id: itemTransacaoAg.id } } });
      favorecido = itemTransacao?.clienteFavorecido;
    } else {
      const itemTransacaoAg = detalheADTO.headerLote.headerArquivo.transacaoAgrupado?.itemTransacoesAgrupado[0];
      const itemTransacao = await this.itemTransacaoService.findOne({ where: { itemTransacaoAgrupado: { id: itemTransacaoAg?.id } } });
      favorecido = itemTransacao?.clienteFavorecido;
    }

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
      if (valorAPagar === undefined) {
        detalheA.valorLancamento.value = itemTransacaoAg.valor;
        detalheA.valorRealEfetivado.value = itemTransacaoAg.valor;
      } else if (valorAPagar !== undefined && valorAPagar >= 0) {
        detalheA.valorLancamento.value = valorAPagar;
        detalheA.valorRealEfetivado.value = itemTransacaoAg.valor;
      }
    } else {
      detalheA.valorLancamento.value = detalheADTO.valorLancamento;
    }
    if (valorAPagar == 0) {
      detalheA.nsr.value = 0;
    } else {
      detalheA.nsr.value = nsr;
    }
    // DetalheB
    const detalheB: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
    detalheB.tipoInscricao.value = getTipoInscricao(asString(favorecido.cpfCnpj));
    detalheB.numeroInscricao.value = asString(favorecido.cpfCnpj);
    if (dataPgto == undefined) {
      detalheB.dataVencimento.value = detalheA.dataVencimento.value;
    } else {
      detalheB.dataVencimento.value = dataPgto;
    }

    detalheB.logradouro.value = favorecido.logradouro;
    detalheB.numeroLocal.value = favorecido.numero;
    detalheB.complemento.value = favorecido.complemento;
    detalheB.bairro.value = favorecido.bairro;
    detalheB.cidade.value = favorecido.cidade;
    detalheB.cep.value = favorecido.cep;
    detalheB.complementoCep.value = favorecido.complementoCep;
    detalheB.siglaEstado.value = favorecido.uf;

    if (detalheA.nsr.value > 0) {
      detalheB.nsr.value = nsr + 1;
    } else {
      detalheB.nsr.value = 0;
    }

    if (!isCancelamento) {
      const savedDetalheA = await this.saveDetalheA(detalheA, asNumber(headerLote.id), itemTransacaoAg);
      await this.saveDetalheB(detalheB, savedDetalheA.id);
    }

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  async saveDetalheA(detalheA104: CnabDetalheA_104, savedHeaderLoteId: number, itemTransacaoAg: ItemTransacaoAgrupado) {
    const detalheADTO = await this.convertCnabDetalheAToDTO(detalheA104, savedHeaderLoteId, itemTransacaoAg);
    
    const saved = await this.detalheAService.save(detalheADTO);
    return saved;
   
  }

  async saveDetalheB(detalheB104: CnabDetalheB_104, savedDetalheAId: number) {
    const detalheBDTO = await this.convertCnabDetalheBToDTO(detalheB104, savedDetalheAId);   
    await this.detalheBService.save(detalheBDTO);
    
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
