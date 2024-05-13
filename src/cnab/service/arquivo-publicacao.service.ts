import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday } from 'date-fns';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { DeepPartial, FindManyOptions } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivo } from '../entity/pagamento/header-arquivo.entity';
import { HeaderLote } from '../entity/pagamento/header-lote.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';
import { Transacao } from '../entity/pagamento/transacao.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
import { OcorrenciaService } from './ocorrencia.service';
import { DetalheAService } from './pagamento/detalhe-a.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { HeaderLoteService } from './pagamento/header-lote.service';

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
  ) {}

  public findMany(options: FindManyOptions<ArquivoPublicacao>) {
    return this.arquivoPublicacaoRepository.findMany(options);
  }

  /**
   * Generates a new ArquivoPublicacao.
   *
   * **status** is Created.
   */
  public generatePublicacaoDTO(
    itemTransacao: ItemTransacao,
  ): ArquivoPublicacao {
    let friday = new Date();
    if (isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const arquivo = new ArquivoPublicacao({
      // Remessa
      idTransacao: asNumber(itemTransacao.transacao?.id),
      itemTransacao: { id: itemTransacao.id },
      // Retorno
      isPago: false,
      dataGeracaoRetorno: null,
      horaGeracaoRetorno: null,
      dataVencimento: friday,
      dataEfetivacao: null,
      valorRealEfetivado: null,
    });
    return arquivo;
  }

  public async save(publicacao: DeepPartial<ArquivoPublicacao>) {
    await this.arquivoPublicacaoRepository.save(publicacao);
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
        'Não há novas remessas para atualizar ArquivoPublicacao, ignorando sub-rotina...',
        METHOD,
      );
    }

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
        await this.salvaOcorrenciasHeaderLote(headerLote);

        // DetalheA Retorno
        for (const detalheA of detalhesA) {
          // Save retorno and update Transacao, Publicacao
          await this.salvaOcorrenciasDetalheA(detalheA);
          await this.savePublicacaoRetorno(headerArquivo, detalheA);
        }
      }
    }
  }

  async salvaOcorrenciasDetalheA(detalheARetorno: DetalheA) {
    if (!detalheARetorno.ocorrenciasCnab) {
      return;
    }
    const ocorrenciasDetalheA = Ocorrencia.newList(
      asString(detalheARetorno.ocorrenciasCnab),
    );

    // Update
    for (const ocorrencia of ocorrenciasDetalheA) {
      ocorrencia.detalheA = detalheARetorno;
    }
    if (ocorrenciasDetalheA.length === 0) {
      return;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrenciasDetalheA);
  }

  async salvaOcorrenciasHeaderLote(headerLote: HeaderLote) {
    if (!headerLote.ocorrenciasCnab) {
      return;
    }
    const ocorrenciasHeaderLote = Ocorrencia.newList(
      asString(headerLote.ocorrenciasCnab),
    );

    // Update
    for (const ocorrencia of ocorrenciasHeaderLote) {
      ocorrencia.headerLote = headerLote;
    }
    if (ocorrenciasHeaderLote.length === 0) {
      return;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrenciasHeaderLote);
  }

  /**
   * This task will:
   * - Save new item from Pagamento.
   * - Then update status.
   *
   * Each ArqPublicacao represents 1 unique ItemTransacao (detalhe A)
   *
   */
  private async savePublicacaoRetorno(
    headerArquivo: HeaderArquivo,
    detalheA: DetalheA,
  ) {
    await this.updatePublicacoesFromDetalheARet(detalheA);

    // Update status
    await this.headerArquivoService.save({
      id: headerArquivo.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.publicado),
    });
  }

  /**
   * Atualizar publicacoes de retorno
   */
  async updatePublicacoesFromDetalheARet(detalheARetorno: DetalheA) {
    const transacaoAgTransacoes =
      detalheARetorno.headerLote.headerArquivo.transacaoAgrupado?.transacoes;
    const transacao = detalheARetorno.headerLote.headerArquivo.transacao;
    const transacoes = transacaoAgTransacoes || [transacao as Transacao];
    for (const transacao of transacoes) {
      for (const item of transacao.itemTransacoes) {
        const publicacao = await this.arquivoPublicacaoRepository.getOne({
          where: {
            itemTransacao: {
              id: item.id,
            },
            idTransacao: transacao.id,
          },
        });
        publicacao.isPago =
          detalheARetorno.ocorrenciasCnab?.trim() === '00' ||
          detalheARetorno.ocorrenciasCnab?.trim() === 'BD';
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
}
