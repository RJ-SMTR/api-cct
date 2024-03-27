import { Injectable, Logger } from '@nestjs/common';
import { logLog } from 'src/utils/log-utils';
import { ArquivoPublicacaoDTO } from '../dto/arquivo-publicacao.dto';
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
            await this.saveNewPgto(remessa, retorno, headerLoteRetorno, pagador, detalheA);
          }
        }
      }
    }
  }

  /**
   * Save new item from Pagamento.
   *  Then update status.
   */
  private async saveNewPgto(
    remessa: HeaderArquivo,
    retorno: HeaderArquivo,
    headerLoteRetorno: HeaderLote,
    pagador: Pagador,
    detalheA: DetalheA,
  ) {
    const favorecido = detalheA.clienteFavorecido;
    const arquivoPublicacao = new ArquivoPublicacaoDTO({
      headerArquivo: { id: remessa.id },
      idTransacao: remessa.transacao.id,
      dataGeracaoRemessa: remessa.dataGeracao,
      horaGeracaoRemessa: remessa.dataGeracao,
      dataGeracaoRetorno: retorno.dataGeracao,
      horaGeracaoRetorno: retorno.horaGeracao,
      loteServico: detalheA.loteServico,
      dataVencimento: detalheA.dataVencimento,
      valorLancamento: detalheA.valorLancamento,
      dataEfetivacao: detalheA.dataEfetivacao,
      valorRealEfetivado: detalheA.valorRealEfetivado,
      nomeCliente: favorecido.nome,
      cpfCnpjCliente: favorecido.cpfCnpj,
      codigoBancoCliente: favorecido.codigoBanco,
      agenciaCliente: favorecido.agencia,
      dvAgenciaCliente: favorecido.dvAgencia,
      contaCorrenteCliente: favorecido.contaCorrente,
      dvContaCorrenteCliente: favorecido.dvContaCorrente,
      ocorrencias: detalheA.ocorrencias || '',
      agenciaPagador: pagador.agencia,
      contaPagador: pagador.conta,
      dvAgenciaPagador: pagador.dvAgencia,
      dvContaPagador: pagador.dvConta,
      idHeaderLote: headerLoteRetorno.id,
      nomePagador: pagador.nomeEmpresa,
      idDetalheARetorno: detalheA.id,
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
}

