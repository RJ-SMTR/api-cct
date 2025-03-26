import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { OrdemPagamentoAgrupadoHistorico } from "../entity/ordem-pagamento-agrupado-historico.entity";
import { DetalheADTO } from "src/cnab/dto/pagamento/detalhe-a.dto";
import { Cnab104FormaParcelamento } from "src/cnab/enums/104/cnab-104-forma-parcelamento.enum";


@Injectable()
export class HeaderLoteToDetalheA {

  static logger = new CustomLogger(HeaderLoteToDetalheA.name, { timestamp: true });

  constructor() { }

  static async convert(headerLote: HeaderLote, ordem: OrdemPagamentoAgrupado, nsr?: number,
    hist?: OrdemPagamentoAgrupadoHistorico, numeroDocumento?: number) {

    const da = new DetalheADTO();
    da.headerLote = headerLote;
    da.nsr = nsr;
    da.dataVencimento = hist?.dataReferencia ?? ordem.dataPagamento;
    da.periodoVencimento = ordem.dataPagamento;

    const nomeConsorcio = ordem.ordensPagamento[0].nomeConsorcio;
    // if (nomeConsorcio === 'Intersul') {
    //   da.valorLancamento = ordem.valorTotal;
    //   da.valorRealEfetivado = ordem.valorTotal;
    // }

    // if (nomeConsorcio === 'Transcarioca') {
    //   da.valorLancamento = ordem.valorTotal;
    //   da.valorRealEfetivado = ordem.valorTotal;
    // }

    // if (nomeConsorcio === 'Internorte') {
    //   da.valorLancamento = ordem.valorTotal;
    //   da.valorRealEfetivado = ordem.valorTotal;
    // }

    // if (nomeConsorcio === 'MobiRio') {
    //   da.valorLancamento = ordem.valorTotal;
    //   da.valorRealEfetivado = ordem.valorTotal;
    // }

    // if (nomeConsorcio === 'Santa Cruz') {
    //   da.valorLancamento = ordem.valorTotal;
    //   da.valorRealEfetivado = ordem.valorTotal;
    // }

    da.valorLancamento = ordem.valorTotal;
    da.valorRealEfetivado = ordem.valorTotal;
    da.numeroDocumentoEmpresa = numeroDocumento;
    da.indicadorBloqueio = 'N';
    da.quantidadeMoeda = 0;
    da.indicadorFormaParcelamento = Cnab104FormaParcelamento.DataFixa.toString();
    da.finalidadeDOC = "00";
    da.loteServico = headerLote.formaLancamento === '41' ? 1 : 2;
    da.tipoMoeda = 'BRL';
    da.numeroDocumentoBanco = "0";
    da.numeroParcela = 1;
    da.quantidadeParcelas = 1;
    if (hist)
      da.ordemPagamentoAgrupadoHistorico = hist;
    return da;
  }
}