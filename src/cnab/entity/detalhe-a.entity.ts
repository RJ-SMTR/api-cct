
import { EntityHelper } from './../../utils/entity-helper';
@Entity()
class DetalheA extends EntityHelper{
    id_detalhe_a:number;
    id_header_lote :number;
    lote_servico :string;
    id_cliente_favorecido :number;
    tipo_finalidade_conta :string;
    dt_vencimento: Date;
    tipo_moeda :string;
    qtde_moeda :number;
    valor_lancamento: number;
    num_doc_lancamento :string;
    qtde_parcelas :number;
    indicador_bloqueio :string;
    indicador_forma_parcelamento :string;
    periodo_vencimento:Date;
    num_parcela :number;
    data_efetivacao: Date;
    valor_real_efetivado:number
}

function Entity(): (target: typeof DetalheA) => void | typeof DetalheA {
    throw new Error("Function not implemented.");
}
