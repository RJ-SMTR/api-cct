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
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from '../enums/pagamento/header-arquivo-tipo-arquivo.enum';
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
    const METHOD = 'compareRemessaToRetorno()';
    const newRemessas = await this.headerArquivoService.findAllNewRemessa();
    if (!newRemessas.length) {
      this.logger.log(
        'Não há novas remessas para atualizar ArquivoPublicacao, ignorando sub-rotina...',
        METHOD,
      );
    }

    // Header Arquivo Remessa
    for (const headerArquivoRem of newRemessas) {
      const headerArquivoRet = await this.headerArquivoService.findOne({
        tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
        nsa: headerArquivoRem.nsa,
        transacao: { id: headerArquivoRem.transacao.id },
      });
      // If no retorno for new remessa, skip
      if (!headerArquivoRet) {
        continue;
      }

      // Header Arquivo Retorno
      const headersLoteRetorno = await this.headerLoteService.findMany({
        headerArquivo: { id: headerArquivoRet.id },
      });

      // Header lote Retorno
      for (const headerLoteRetorno of headersLoteRetorno) {
        const detalhesARet = await this.detalheAService.findMany({
          headerLote: { id: headerLoteRetorno.id },
        });
        await this.salvaOcorrenciasHeaderLote(headerLoteRetorno);

        // DetalheA Retorno
        for (const detalheARet of detalhesARet) {
          // Save retorno and update Transacao, Lancamento
          await this.salvaOcorrenciasDetalheA(detalheARet);
          await this.savePublicacaoRetorno(
            headerArquivoRem,
            headerArquivoRet,
            detalheARet,
          );
        }
      }
    }
  }

  async salvaOcorrenciasDetalheA(detalheARetorno: DetalheA) {
    const ocorrenciasDetalheA = Ocorrencia.newList(
      asString(detalheARetorno.ocorrenciasCnab),
    );

    // Update DetalheA
    for (const ocorrencia of ocorrenciasDetalheA) {
      ocorrencia.detalheA = detalheARetorno;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrenciasDetalheA);
  }

  async salvaOcorrenciasHeaderLote(headerLote: HeaderLote) {
    const ocorrenciasHeaderLote = Ocorrencia.newList(
      asString(headerLote.ocorrenciasCnab),
    );

    // Update DetalheA
    for (const ocorrencia of ocorrenciasHeaderLote) {
      ocorrencia.headerLote = headerLote;
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
    remessa: HeaderArquivo,
    retorno: HeaderArquivo,
    detalheARetorno: DetalheA,
  ) {
    await this.updatePublicacoesFromDetalheARet(detalheARetorno);

    // Update status
    await this.headerArquivoService.save({
      id: remessa.id,
      status: new HeaderArquivoStatus(
        HeaderArquivoStatusEnum.arquivoPublicacaoSaved,
      ),
    });
    await this.headerArquivoService.save({
      id: retorno.id,
      status: new HeaderArquivoStatus(
        HeaderArquivoStatusEnum.arquivoPublicacaoSaved,
      ),
    });
  }

  /**
   * Atualizar publicacoes de retorno
   */
  async updatePublicacoesFromDetalheARet(detalheARetorno: DetalheA) {
    const transacoes =
      detalheARetorno.itemTransacaoAgrupado?.transacaoAgrupado.transacoes;
    for (const transacao of transacoes || []) {
      for (const item of transacao.itemTransacoes) {
        const publicacao = await this.arquivoPublicacaoRepository.getOne({
          where: {
            itemTransacao: {
              id: item.id,
            },
            idTransacao: transacao.id,
          },
        });
        publicacao.dataEfetivacao = detalheARetorno.itemTransacaoAgrupado
          ?.dataProcessamento as Date;
        publicacao.isPago = detalheARetorno.ocorrenciasCnab?.trim() === '00';
        if (publicacao.isPago) {
          publicacao.valorRealEfetivado = publicacao.itemTransacao.valor;
        }
        await this.arquivoPublicacaoRepository.save(publicacao);
      }
    }
  }
}
