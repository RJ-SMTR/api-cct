import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { OrdemPagamentoAgrupadoHistorico } from "../entity/ordem-pagamento-agrupado-historico.entity";
import { DetalheADTO } from "src/cnab/dto/pagamento/detalhe-a.dto";


@Injectable()
export class HeaderLoteToDetalheA {
    
    static logger = new CustomLogger(HeaderLoteToDetalheA.name, { timestamp: true });   

    constructor() { }

    static async convert(headerLote: HeaderLote,ordem: OrdemPagamentoAgrupado,nsr?: number,
       hist?:OrdemPagamentoAgrupadoHistorico,numeroDocumento?: number){     
       
        const da = new DetalheADTO();
        da.headerLote = headerLote;
        da.nsr = nsr?nsr:1;
        da.dataVencimento = ordem.dataPagamento;
        da.valorLancamento = ordem.valorTotal;
        da.quantidadeParcelas = 1;   
        da.numeroDocumentoEmpresa  = numeroDocumento;         
        if(hist)
          da.ordemPagamentoAgrupadoHistorico = hist;
        return da;
    }
}