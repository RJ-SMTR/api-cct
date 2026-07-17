import { Injectable } from "@nestjs/common";
import { BigqueryOrdemPagamentoDTO } from "src/bigquery/dtos/bigquery-ordem-pagamento.dto";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamento } from "../entity/ordem-pagamento.entity";
import { BigqueryOrdemPagamentoGuardadorDTO } from "src/bigquery/dtos/bigquery-ordem-pagamento-guardador.dto";
import { OrdemPagamentoGuardador } from "../entity/ordem-pagamento-guardador.entity";


@Injectable()
export class BigQueryToOrdemPagamento {
    
    static logger = new CustomLogger(BigQueryToOrdemPagamento.name, { timestamp: true });   

    constructor() { }

    static convert(ordem: BigqueryOrdemPagamentoDTO, userId: number | undefined) {
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
        result.dataCaptura = ordem.dataCaptura;
        return result;
    }


    static convertOrdemGuardador(ordem: BigqueryOrdemPagamentoGuardadorDTO) {
        const METHOD = 'convert';
        this.logger.debug(`Sincronizado ${ordem.id} `, METHOD);
        var result = new OrdemPagamentoGuardador();
        result.id = ordem.id;
        result.dataOrdem = new Date(ordem.dataOrdem);
        result.dataInclusao = new Date(ordem.dataInclusao);
        result.dataPagamento = new Date(ordem.dataPagamento);
        result.idCliente = ordem.idCliente;
        result.idOrdemPagamentoEstacionamento = ordem.idOrdemPagamentoEstacionamento;
        result.idStatusOrdem = ordem.idStatusOrdem;
        result.qtdVerificado = ordem.qtdVerificado;       
        return result;
    }
}