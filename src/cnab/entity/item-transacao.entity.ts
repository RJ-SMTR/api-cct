import { EntityHelper } from "src/utils/entity-helper";


@Entity()
class ItemTransacao extends EntityHelper{
    id_item_transacao:number;
    dt_transacao: Date;
    dt_processamentoDate;
    dt_capturaDate;
    modo:string;
    nome_consorcio:string;
    id_tipo_pagamento:number;
    tipo_transacao:string;
    valor_item_transacao:number;
    id_transacao:number;
}

function Entity(): (target: typeof ItemTransacao) => void | typeof ItemTransacao {
    throw new Error("Function not implemented.");
}
