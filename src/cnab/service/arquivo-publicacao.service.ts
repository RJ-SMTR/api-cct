import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asString } from 'src/utils/pipe-utils';
import { DeepPartial, In } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivo } from '../entity/pagamento/header-arquivo.entity';
import { HeaderLote } from '../entity/pagamento/header-lote.entity';
import { Pagador } from '../entity/pagamento/pagador.entity';
import { TransacaoOcorrencia } from '../entity/pagamento/transacao-ocorrencia.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from '../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
import { DetalheAService } from './pagamento/detalhe-a.service';
import { HeaderArquivoService } from './pagamento/header-arquivo.service';
import { HeaderLoteService } from './pagamento/header-lote.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';

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
  ) {}

  public generateDTOs(
    ordens: BigqueryOrdemPagamentoDTO[],
    pagador: Pagador,
    favorecidos: ClienteFavorecido[],
  ): ArquivoPublicacao[] {
    const publicacoes: ArquivoPublicacao[] = [];
    for (const ordem of ordens) {
      // Get ClienteFavorecido
      const favorecido: ClienteFavorecido | undefined = favorecidos.filter(
        (i) =>
          i.cpfCnpj === ordem.operadoraCpfCnpj ||
          i.cpfCnpj === ordem.consorcioCnpj,
      )[0];
      if (!favorecido) {
        // Ignore publicacao with no ClienteFavorecidos
        continue;
      }
      publicacoes.push(this.generateRemessaDTO(ordem, pagador, favorecido));
    }
    return publicacoes;
  }

  /**
   * Generates a new ArquivoPublicacao.
   *
   * **status** is Created.
   */
  public generateRemessaDTO(
    ordem: BigqueryOrdemPagamentoDTO,
    pagador: Pagador,
    favorecido: ClienteFavorecido,
  ): ArquivoPublicacao {
    let friday = new Date();
    if (isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const arquivo = new ArquivoPublicacao({
      // Remessa
      headerArquivo: null,
      transacao: { id: -1 },
      idHeaderLote: null,
      dataGeracaoRemessa: null,
      horaGeracaoRemessa: null,
      // Retorno
      isPago: false,
      dataGeracaoRetorno: null,
      horaGeracaoRetorno: null,
      dataVencimento: friday,
      valorLancamento: null,
      dataEfetivacao: null,
      valorRealEfetivado: null,
      // Detalhe A retorno
      idDetalheARetorno: null,
      loteServico: null,
      nomePagador: pagador.nomeEmpresa,
      agenciaPagador: pagador.agencia,
      dvAgenciaPagador: pagador.dvAgencia,
      contaPagador: pagador.conta,
      dvContaPagador: pagador.dvConta,
      // Favorecido
      nomeCliente: favorecido.nome,
      cpfCnpjCliente: favorecido.cpfCnpj,
      codigoBancoCliente: favorecido.codigoBanco,
      agenciaCliente: favorecido.agencia,
      dvAgenciaCliente: favorecido.dvAgencia,
      contaCorrenteCliente: favorecido.contaCorrente,
      dvContaCorrenteCliente: favorecido.dvContaCorrente,
      // OrdemPagamento
      idOrdemPagamento: ordem.idOrdemPagamento,
      idConsorcio: ordem.idConsorcio,
      idOperadora: ordem.idOperadora,
      dataOrdem: ordem.dataOrdem,
      nomeConsorcio: ordem.consorcio,
      nomeOperadora: ordem.operadora,
      valorTotalTransacaoLiquido: ordem.valorTotalTransacaoLiquido,
    });
    return arquivo;
  }

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
   * Associate Publicacao with DetalheARet via:
   * 1. retorno > ItemTransacao > detalheA === retorno > lote > detalheA
   * 2. detalheA[idConsorcio, idOperadora, idOrdem] === Publicacao[idConsorcio, idOperadora, idOrdem]
   */
  private async savePublicacaoRetorno(
    remessa: HeaderArquivo,
    retorno: HeaderArquivo,
    headerLoteRetorno: HeaderLote,
    pagador: Pagador,
    detalheARetorno: DetalheA,
  ) {
    // 1.
    const itens = await this.itemTransacaoService.findManyByIdTransacao(
      retorno.transacao.id,
    );
    const itemTransacao = itens
      .filter((i) => i.detalheA?.id === detalheARetorno.id)
      .pop();
    if (!itemTransacao) {
      throw CommonHttpException.notFound('itemTransacao');
    }

    // 2.
    const publicacao = await this.arquivoPublicacaoRepository.getOne({
      where: {
        idConsorcio: asString(itemTransacao.idConsorcio),
        idOperadora: asString(itemTransacao.idOperadora),
        idOrdemPagamento: asString(itemTransacao.idOrdemPagamento),
      },
    });

    // dataEfetivacao: Date;
    // valorRealEfetivado: number;
    // idDetalheARetorno: number;
    const ocorrencias = TransacaoOcorrencia.newList(
      asString(detalheARetorno.ocorrencias),
    );
    /** If Ocorrencia is successfull */
    const isPago = detalheARetorno.ocorrencias?.trim() === '00';
    const publicacaoUpdateDTO: DeepPartial<ArquivoPublicacao> = {
      dataGeracaoRetorno: retorno.dataGeracao,
      horaGeracaoRetorno: retorno.horaGeracao,
      valorLancamento: detalheARetorno.valorRealEfetivado,
      dataEfetivacao: retorno.dataGeracao,
      isPago: isPago,
      transacao: {
        id: retorno.transacao.id,
        ocorrencias: ocorrencias,
      },
      // valorLancamento = ,
    };
    await this.arquivoPublicacaoRepository.update(
      publicacao.id,
      publicacaoUpdateDTO,
    );

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

  public updateManyFromTransacao(arquivos: DeepPartial<ArquivoPublicacao>[]) {
    return this.arquivoPublicacaoRepository.upsert(arquivos);
  }
}
