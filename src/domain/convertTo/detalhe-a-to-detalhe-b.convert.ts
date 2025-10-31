import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { DetalheA } from "src/domain/entity/detalhe-a.entity";
import { HeaderLote } from "src/domain/entity/header-lote.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { DetalheB } from "src/domain/entity/detalhe-b.entity";


@Injectable()
export class DetalheAToDetalheB {
    
    static logger = new CustomLogger(DetalheAToDetalheB.name, { timestamp: true });   

    constructor() { }

    static convert(detalheA: DetalheA,ordem: OrdemPagamentoAgrupado){       
        const db = new DetalheB();
        db.detalheA = detalheA;
        db.nsr = detalheA.nsr+1;
        db.dataVencimento = ordem.dataPagamento
        db.createdAt = new Date();
        return db;
    }
}