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

    const nomeConsorcio = ordem.ordensPagamento[0].nomeConsorcio;
    if (nomeConsorcio === 'Intersul') {
      da.valorLancamento = 251407.70;
      da.valorRealEfetivado = 251407.70;
    }

    if (nomeConsorcio === 'Transcarioca') {
      da.valorLancamento = 493902.78;
      da.valorRealEfetivado = 493902.78;
    }

    if (nomeConsorcio === 'Internorte') {
      da.valorLancamento = 557045.54;
      da.valorRealEfetivado = 557045.54;
    }

    if (nomeConsorcio === 'MobiRio') {
      da.valorLancamento = ordem.valorTotal;
      da.valorRealEfetivado = ordem.valorTotal;
    }

    if (nomeConsorcio === 'Santa Cruz') {
      da.valorLancamento = 476517.54;
      da.valorRealEfetivado = 476517.54;
    }

    da.headerLote = headerLote;
    da.nsr = nsr;
    da.dataVencimento = hist?.dataReferencia ?? ordem.dataPagamento;
    da.periodoVencimento = ordem.dataPagamento;
    // da.valorLancamento = ordem.valorTotal;
    // da.valorRealEfetivado = ordem.valorTotal;
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