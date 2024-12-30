import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { DetalheA } from "src/cnab/entity/pagamento/detalhe-a.entity";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";


@Injectable()
export class HeaderLoteToDetalheA {
    
    static logger = new CustomLogger(HeaderLoteToDetalheA.name, { timestamp: true });   

    constructor() { }

    static convert(headerLote: HeaderLote,ordem: OrdemPagamentoAgrupado,nsr?: number){       
        const da = new DetalheA();
        da.headerLote = headerLote;
        da.nsr = nsr?nsr:1;
        da.dataVencimento = ordem.dataPagamento;
        da.valorLancamento = ordem.valorTotal;
        da.quantidadeParcelas = 1;
        da.createdAt = new Date();
        return da;
    }
}