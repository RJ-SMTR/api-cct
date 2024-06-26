import { Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  isDate,
  isFriday,
  isThursday,
  nextFriday,
  startOfDay,
} from 'date-fns';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { asNumber } from 'src/utils/pipe-utils';
import { DeepPartial, FindManyOptions } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';
import { TransacaoStatus } from '../entity/pagamento/transacao-status.entity';
import { TransacaoStatusEnum } from '../enums/pagamento/transacao-status.enum';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
import { OcorrenciaService } from './ocorrencia.service';
import { DetalheAService } from './pagamento/detalhe-a.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { HeaderLoteService } from './pagamento/header-lote.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';
import { TransacaoAgrupadoService } from './pagamento/transacao-agrupado.service';
import { TransacaoService } from './pagamento/transacao.service';

@Injectable()
export class ArquivoPublicacaoService {
  private logger: Logger = new Logger('ArquivoPublicacaoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private arquivoPublicacaoRepository: ArquivoPublicacaoRepository,
    private headerLoteService: HeaderLoteService,
    private detalheAService: DetalheAService,
    private transacaoOcorrenciaService: OcorrenciaService,
    private transacaoAgService: TransacaoAgrupadoService,
    private transacaoService: TransacaoService,
    private transacaoViewService: TransacaoViewService,
    private itemTransacaoService: ItemTransacaoService,
  ) { }
  
  public findMany(options: FindManyOptions<ArquivoPublicacao>) {
    return this.arquivoPublicacaoRepository.findMany(options);
  }

  public async findManyByDate(startDate: Date, endDate: Date) {
    return await this.arquivoPublicacaoRepository.findManyByDate(
      startDate,
      endDate,
    );
  }

  /**
   * Generates a new ArquivoPublicacao.
   *
   * **status** is Created.
   */
  async savePublicacaoDTO(
    itemTransacao: ItemTransacao,
  ): Promise<ArquivoPublicacao> {
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: {
        itemTransacao: {
          id: itemTransacao.id,
        },
      },
    });
    const ordem = itemTransacao.dataOrdem;
    if (!isDate(ordem) || !ordem) {
      console.warn('erro');
    }

    /** Como é data relativa, se for quinta, pega a sexta da próxima semana */
    const friday = isThursday(ordem) ? addDays(ordem, 8) : nextFriday(ordem);

    const arquivo = new ArquivoPublicacao({
      ...(existing ? { id: existing.id } : {}),
      // Remessa
      idTransacao: asNumber(itemTransacao.transacao?.id),
      itemTransacao: { id: itemTransacao.id },
      // Retorno
      isPago: false,
      dataGeracaoRetorno: null,
      horaGeracaoRetorno: null,
      dataVencimento: startOfDay(friday),
      dataEfetivacao: null,
      valorRealEfetivado: null,
    });
    return arquivo;
  }

  public async save(
    publicacao: DeepPartial<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao> {
    return await this.arquivoPublicacaoRepository.save(publicacao);
  }

  /**
   * updateFromRemessaRetorno()
   *
   * From Remessa and Retorno, save new ArquivoPublicacao
   *
   * This task will:
   * 1. Find all new Remessa
   * 2. For each remessa get corresponding Retorno, HeaderLote and Detalhes
   * 3. For each DetalheA, save new ArquivoPublicacao if not exists
   */
  public async compareRemessaToRetorno(): Promise<void> {
    const METHOD = this.compareRemessaToRetorno.name;
    const headerArquivos = await this.headerArquivoService.findRetornos();
    if (!headerArquivos.length) {
      this.logger.log(
        'Não há novas retornos para atualizar ArquivoPublicacao, ignorando sub-rotina...',
        METHOD,
      );
    }
    let transacaoAgrupado = -1;

    // Header Arquivo Remessa
    for (const headerArquivo of headerArquivos) {
      // If no retorno for new remessa, skip
      if (!headerArquivo) {
        continue;
      }

      // Header Arquivo Retorno
      const headersLote = await this.headerLoteService.findMany({
        headerArquivo: { id: headerArquivo.id },
      });

      // Header lote Retorno
      for (const headerLote of headersLote) {
        const detalhesA = await this.detalheAService.findMany({
          headerLote: { id: headerLote.id },
        });

        // DetalheA Retorno
        for (const detalheA of detalhesA) {
          // Save retorno and update Transacao, Publicacao
          await this.salvaOcorrenciasDetalheA(detalheA);
          await this.savePublicacaoRetorno(detalheA);

          if (transacaoAgrupado === -1) {
            transacaoAgrupado =
              detalheA?.itemTransacaoAgrupado?.transacaoAgrupado?.id;
          }
        }
      }

      // Update HeaderArquivo Status
      await this.headerArquivoService.save({
        id: headerArquivo.id,
      });
    }

    // Update TransacaoAgrupado
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    await this.transacaoAgService.save({
      id: transacaoAgrupado,
      status: new TransacaoStatus(TransacaoStatusEnum.publicado),
      dataPagamento: startOfDay(friday),
    });
  }

  async salvaOcorrenciasDetalheA(detalheARetorno: DetalheA) {
    if (!detalheARetorno.ocorrenciasCnab) {
      return;
    }
    const ocorrencias = Ocorrencia.fromCodesString(
      detalheARetorno.ocorrenciasCnab,
    );
    // Update
    for (const ocorrencia of ocorrencias) {
      ocorrencia.detalheA = detalheARetorno;
    }
    if (ocorrencias.length === 0) {
      return;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrencias);
  }

  /**
   * Atualizar publicacoes de retorno
   */
  async savePublicacaoRetorno(detalheARetorno: DetalheA) {
    const itens = await this.itemTransacaoService.findMany({
      where: {
        itemTransacaoAgrupado: {
          id: detalheARetorno.itemTransacaoAgrupado.id,
        },
      },
    });
    for (const item of itens) {
      const publicacao = await this.arquivoPublicacaoRepository.getOne({
        where: {
          itemTransacao: {
            id: item.id,
          },
        },
      });
      publicacao.isPago = detalheARetorno.isPago();
      if (publicacao.isPago) {
        publicacao.valorRealEfetivado = publicacao.itemTransacao.valor;
        publicacao.dataEfetivacao = detalheARetorno.dataEfetivacao;
      }
      publicacao.dataGeracaoRetorno =
        detalheARetorno.headerLote.headerArquivo.dataGeracao;
      publicacao.horaGeracaoRetorno =
        detalheARetorno.headerLote.headerArquivo.horaGeracao;

      await this.arquivoPublicacaoRepository.save(publicacao);
    }
  }
}
