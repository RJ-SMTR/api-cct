import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { DetalheA } from "src/cnab/entity/pagamento/detalhe-a.entity";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { OrdemPagamentoAgrupadoService } from "../service/ordem-pagamento-agrupado.service";


@Injectable()
export class HeaderLoteToDetalheA {
    
    static logger = new CustomLogger(HeaderLoteToDetalheA.name, { timestamp: true });   

    private static ordemPagamentoAgService: OrdemPagamentoAgrupadoService;

    constructor() { }

    static async convert(headerLote: HeaderLote,ordem: OrdemPagamentoAgrupado,nsr?: number){       
        const da = new DetalheA();
        da.headerLote = headerLote;
        da.nsr = nsr?nsr:1;
        da.dataVencimento = ordem.dataPagamento;
        da.valorLancamento = ordem.valorTotal;
        da.quantidadeParcelas = 1;
        const hist = await this.ordemPagamentoAgService.getUltimoHistoricoOrdem(ordem);
        if(hist){
          da.ordemPagamentoAgrupadoHistorico = hist;
        }
        da.createdAt = new Date();
        return da;
    }
}