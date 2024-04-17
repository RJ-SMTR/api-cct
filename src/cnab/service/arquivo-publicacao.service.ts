import { Injectable, Logger } from '@nestjs/common';
import { isFriday, nextFriday } from 'date-fns';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { logLog } from 'src/utils/log-utils';
import { asDate } from 'src/utils/pipe-utils';
import { DeepPartial, In } from 'typeorm';
import { ArquivoPublicacaoDTO } from '../dto/arquivo-publicacao.dto';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { HeaderArquivoStatus } from '../entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivo } from '../entity/pagamento/header-arquivo.entity';
import { HeaderLote } from '../entity/pagamento/header-lote.entity';
import { Pagador } from '../entity/pagamento/pagador.entity';
import { HeaderArquivoStatusEnum } from '../enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from '../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
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
  ) { }


  public generateDTOs(
    ordens: BigqueryOrdemPagamentoDTO[],
    pagador: Pagador,
    favorecidos: ClienteFavorecido[],
  ): ArquivoPublicacao[] {
    const publicacoes: ArquivoPublicacao[] = [];
    for (const ordem of ordens) {
      // Get ClienteFavorecido
      const favorecido: ClienteFavorecido | undefined = favorecidos.filter(i =>
        i.cpfCnpj === ordem.operadoraCpfCnpj ||
        i.cpfCnpj === ordem.consorcioCnpj
      )[0];
      if (!favorecido) {
        // Ignore publicacao with no ClienteFavorecidos
        continue;
      }
      publicacoes.push(this.generateDTO(ordem, pagador, favorecido));
    }
    return publicacoes;
  }


  /**
   * Generates a new ArquivoPublicacao.
   * 
   * **status** is Created.
   */
  public generateDTO(
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
  public async saveMany(publicacoes: DeepPartial<ArquivoPublicacao>[]): Promise<ArquivoPublicacao[]> {
    const insert = await this.arquivoPublicacaoRepository.insert(publicacoes);
    const publicacaoIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const created = await this.arquivoPublicacaoRepository.findMany({ where: { id: In(publicacaoIds) } });
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
    const remessas = await this.headerArquivoService.findAllNewRemessa();
    if (!remessas.length) {
      logLog(this.logger, 'Não há novas remessas para atualizar ArquivoPublicacao, ignorando sub-rotina...', METHOD);
    }

    // Header Arquivo Remessa
    for (const remessa of remessas) {
      const retornos =
        await this.headerArquivoService.findMany({
          tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
          nsa: remessa.nsa,
          transacao: { id: remessa.transacao.id }
        });

      // Header Arquivo Retorno
      for (const retorno of retornos) {
        const headersLoteRetorno =
          await this.headerLoteService.findMany({ headerArquivo: { id: retorno.id } });

        // Header lote Retorno
        for (const headerLoteRetorno of headersLoteRetorno) {
          const pagador = headerLoteRetorno.pagador;
          const detalhesARet = await this.detalheAService.findMany({ headerLote: { id: headerLoteRetorno.id } });

          // DetalheA Retorno
          for (const detalheA of detalhesARet) {
            await this.savePublicacaoRetorno(remessa, retorno, headerLoteRetorno, pagador, detalheA);
          }
        }
      }
    }
  }

  /**
   * Save new item from Pagamento.
   *  Then update status.
   */
  private async savePublicacaoRetorno(
    remessa: HeaderArquivo,
    retorno: HeaderArquivo,
    headerLoteRetorno: HeaderLote,
    pagador: Pagador,
    detalheARetorno: DetalheA,
  ) {
    const favorecido = detalheARetorno.clienteFavorecido;
    const arquivoPublicacao = new ArquivoPublicacaoDTO({
      headerArquivo: { id: remessa.id },
      idTransacao: remessa.transacao.id,
      dataGeracaoRemessa: remessa.dataGeracao,
      horaGeracaoRemessa: remessa.dataGeracao,
      dataGeracaoRetorno: retorno.dataGeracao,
      horaGeracaoRetorno: retorno.horaGeracao,
      loteServico: detalheARetorno.loteServico,
      dataVencimento: detalheARetorno.dataVencimento,
      valorLancamento: detalheARetorno.valorLancamento,
      dataEfetivacao: asDate(detalheARetorno.dataEfetivacao),
      valorRealEfetivado: detalheARetorno.valorRealEfetivado,
      nomeCliente: favorecido.nome,
      cpfCnpjCliente: favorecido.cpfCnpj,
      codigoBancoCliente: favorecido.codigoBanco,
      agenciaCliente: favorecido.agencia,
      dvAgenciaCliente: favorecido.dvAgencia,
      contaCorrenteCliente: favorecido.contaCorrente,
      dvContaCorrenteCliente: favorecido.dvContaCorrente,
      ocorrencias: detalheARetorno.ocorrencias || '',
      agenciaPagador: pagador.agencia,
      contaPagador: pagador.conta,
      dvAgenciaPagador: pagador.dvAgencia,
      dvContaPagador: pagador.dvConta,
      idHeaderLote: headerLoteRetorno.id,
      nomePagador: pagador.nomeEmpresa,
      idDetalheARetorno: detalheARetorno.id,
    });
    await this.arquivoPublicacaoRepository.saveIfNotExists(arquivoPublicacao);

    // Update status
    await this.headerArquivoService.save({
      id: remessa.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.arquivoPublicacaoSaved),
    });
    await this.headerArquivoService.save({
      id: retorno.id,
      status: new HeaderArquivoStatus(HeaderArquivoStatusEnum.arquivoPublicacaoSaved),
    });
  }

  public updateManyFromTransacao(arquivos: DeepPartial<ArquivoPublicacao>[]) {
    return this.arquivoPublicacaoRepository.upsert(arquivos);
  }
}

