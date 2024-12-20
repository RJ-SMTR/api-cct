import { Injectable } from "@nestjs/common";
import { BigqueryOrdemPagamentoDTO } from "src/bigquery/dtos/bigquery-ordem-pagamento.dto";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamento } from "../entity/ordem-pagamento.entity";


@Injectable()
export class BigQueryToOrdemPagamento {
    
    static logger = new CustomLogger(BigQueryToOrdemPagamento.name, { timestamp: true });   

    constructor() { }

    static convert(ordem: BigqueryOrdemPagamentoDTO, userId: number) {
        const METHOD = 'convert';
        this.logger.debug(`Sincronizado ${ordem.idOrdemPagamento} `, METHOD);
        var result = new OrdemPagamento();
        result.id = ordem.id;
        result.dataOrdem = new Date(ordem.dataOrdem);
        result.idConsorcio = ordem.idConsorcio;
        result.idOperadora = ordem.idOperadora;
        result.operadoraCpfCnpj = ordem.operadoraCpfCnpj;
        result.idOrdemPagamento = ordem.idOrdemPagamento;
        result.nomeConsorcio = ordem.consorcio;
        result.nomeOperadora = ordem.operadora;
        result.userId = userId;
        result.valor = ordem.valorTotalTransacaoLiquido;
        result.bqUpdatedAt = new Date(ordem.datetimeUltimaAtualizacao);
        return result;
    }
}