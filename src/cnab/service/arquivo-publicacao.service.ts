import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday } from 'date-fns';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { DeepPartial, FindManyOptions } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderLote } from '../entity/pagamento/header-lote.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';
import { TransacaoStatus } from '../entity/pagamento/transacao-status.entity';
import { Transacao } from '../entity/pagamento/transacao.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { ItemTransacaoStatusEnum } from '../enums/pagamento/item-transacao-status.enum';
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
    private itemTransacaoService: ItemTransacaoService,
  ) {}

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
  async generatePublicacaoDTO(
    itemTransacao: ItemTransacao,
  ): Promise<ArquivoPublicacao> {
    let friday = new Date();
    if (isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: {
        itemTransacao: { id: itemTransacao.id },
      },
    });
    const arquivo = new ArquivoPublicacao({
      ...(existing ? { id: existing.id } : {}),
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
          await this.savePublicacaoRetorno(detalheA);
        }
      }

      // Update HeaderArquivo Status
      await this.headerArquivoService.save({
        id: headerArquivo.id,
        status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.publicado),
      });
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
   * Atualizar publicacoes de retorno
   */
  async savePublicacaoRetorno(detalheARetorno: DetalheA) {
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

        // Update ItemTransacaoStatus
        await this.itemTransacaoService.save({
          id: publicacao.itemTransacao.id,
          status: { id: ItemTransacaoStatusEnum.publicado },
        });
      }

      // Update Transacao status
      await this.transacaoService.save({
        id: transacao.id,
        status: new TransacaoStatus(TransacaoStatusEnum.publicado),
      });
    }

    // Update status
    const transacaoAg =
      detalheARetorno.headerLote.headerArquivo.transacaoAgrupado;
    if (transacaoAg) {
      await this.transacaoAgService.save({
        id: transacaoAg.id,
        status: new TransacaoStatus(TransacaoStatusEnum.publicado),
      });
    }
  }
}
