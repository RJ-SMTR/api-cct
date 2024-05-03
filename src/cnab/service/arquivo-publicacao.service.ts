import { Injectable, Logger } from '@nestjs/common';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asString } from 'src/utils/pipe-utils';
import { DeepPartial, FindManyOptions, In } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivo } from '../entity/pagamento/header-arquivo.entity';
import { HeaderLote } from '../entity/pagamento/header-lote.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';
import { Pagador } from '../entity/pagamento/pagador.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from '../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
import { OcorrenciaService } from './ocorrencia.service';
import { DetalheAService } from './pagamento/detalhe-a.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { HeaderLoteService } from './pagamento/header-lote.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';
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
    private itemTransacaoService: ItemTransacaoService,
    private transacaoOcorrenciaService: OcorrenciaService,
    private transacaoService: TransacaoService,
  ) {}

  public findMany(options: FindManyOptions<ArquivoPublicacao>) {
    return this.arquivoPublicacaoRepository.findMany(options);
  }

  /**
   * Generates a new ArquivoPublicacao.
   *
   * **status** is Created.
   */
  // public generateRemessaDTO(
  //   itemTransacao: ItemTransacao | ItemTransacaoAgrupado,
  // ): ArquivoPublicacao {
  //   let friday = new Date();
  //   if (isFriday(friday)) {
  //     friday = nextFriday(friday);
  //   }
  //   const arquivo = new ArquivoPublicacao({
  //     // Remessa
  //     idTransacao: asNumber(itemTransacao.transacao?.id),
  //     itemTransacao: { id: itemTransacao.id },
  //     // Retorno
  //     isPago: false,
  //     dataGeracaoRetorno: null,
  //     horaGeracaoRetorno: null,
  //     dataVencimento: friday,
  //     dataEfetivacao: null,
  //     valorRealEfetivado: null,
  //   });
  //   return arquivo;
  // }

  /**
   * From OrdemPagamento and others and bulk insert.
   *
   * @returns `TransacaoBuilder`, so you can group it and add to Transacao.
   */
  public async saveMany(
    publicacoes: DeepPartial<ArquivoPublicacao>[],
  ): Promise<ArquivoPublicacao[]> {
    const insert = await this.arquivoPublicacaoRepository.insert(publicacoes);
    const publicacaoIds = (insert.identifiers as { id: number }[]).reduce(
      (l, i) => [...l, i.id],
      [],
    );
    const created = await this.arquivoPublicacaoRepository.findMany({
      where: { id: In(publicacaoIds) },
    });
    return created;
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
    for (const remessa of newRemessas) {
      const retorno = await this.headerArquivoService.findOne({
        tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
        nsa: remessa.nsa,
        transacao: { id: remessa.transacao.id },
      });
      // If no retorno for new remessa, skip
      if (!retorno) {
        continue;
      }

      // Header Arquivo Retorno
      const headersLoteRetorno = await this.headerLoteService.findMany({
        headerArquivo: { id: retorno.id },
      });

      // Header lote Retorno
      for (const headerLoteRetorno of headersLoteRetorno) {
        const pagador = headerLoteRetorno.pagador;
        const detalhesARet = await this.detalheAService.findMany({
          headerLote: { id: headerLoteRetorno.id },
        });

        // DetalheA Retorno
        for (const detalheA of detalhesARet) {
          // Save retorno and update Transacao, Lancamento
          await this.savePublicacaoRetorno(
            remessa,
            retorno,
            headerLoteRetorno,
            pagador,
            detalheA,
          );
        }
      }
    }
    // const a = 1;
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
    headerLoteRetorno: HeaderLote,
    pagador: Pagador,
    detalheARetorno: DetalheA,
  ) {
    const publicacao = await this.getPublicacaoFromDetalheARet(
      retorno,
      detalheARetorno,
    );
    const ocorrenciasDetalheA = Ocorrencia.newList(
      asString(detalheARetorno.ocorrencias),
    );

    // Update Publicacao
    /** If Ocorrencia is successfull */
    const isPago = detalheARetorno.ocorrencias?.trim() === '00';
    const publicacaoUpdateDTO: DeepPartial<ArquivoPublicacao> = {
      dataGeracaoRetorno: retorno.dataGeracao,
      horaGeracaoRetorno: retorno.horaGeracao,
      valorRealEfetivado: detalheARetorno.valorRealEfetivado,
      dataEfetivacao: retorno.dataGeracao,
      isPago: isPago,
      itemTransacao: {
        id: retorno.transacao.id,
      },
    };
    await this.arquivoPublicacaoRepository.update(
      publicacao.id,
      publicacaoUpdateDTO,
    );

    // Update DetalheA
    await this.transacaoService.update({
      id: retorno.transacao.id,
      dataPagamento: retorno.dataGeracao,
    });

    for (const ocorrencia of ocorrenciasDetalheA) {
      ocorrencia.headerArquivo = { id: retorno.transacao.id } as HeaderArquivo;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrenciasDetalheA);

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
   * Associate Publicacao with DetalheARet via:
   * 1. retorno > ItemTransacao > detalheA === retorno > lote > detalheA
   * 2. detalheA[idConsorcio, idOperadora, idOrdem] === Publicacao[idConsorcio, idOperadora, idOrdem]
   */
  async getPublicacaoFromDetalheARet(
    retorno: HeaderArquivo,
    detalheARetorno: DetalheA,
  ) {
    // 1. Associate ItemTransacaoDetalheA with matching CnabDetalheA
    const itens = await this.itemTransacaoService.findManyByIdTransacao(
      retorno.transacao.id,
    );
    const itemTransacao = itens
      .filter((i) => i.detalheA?.nsr === detalheARetorno.nsr)
      .pop();
    if (!itemTransacao) {
      throw CommonHttpException.notFound('itemTransacao');
    }

    // 2. DetalheA with Arquivo via columns
    const publicacao = await this.arquivoPublicacaoRepository.getOne({
      where: {
        itemTransacao: {
          idConsorcio: asString(itemTransacao.idConsorcio),
          idOperadora: asString(itemTransacao.idOperadora),
          idOrdemPagamento: asString(itemTransacao.idOrdemPagamento),
        },
      },
    });
    return publicacao;
  }

  public updateManyFromTransacao(arquivos: DeepPartial<ArquivoPublicacao>[]) {
    return this.arquivoPublicacaoRepository.upsert(arquivos);
  }
}
