import { EntityHelper } from '../../utils/entity-helper';
@Entity()
class TransacaoClienteItem extends EntityHelper{
    id_item_transacao:number;
    id_cliente_favorecido:number;
}

function Entity(): (target: typeof TransacaoClienteItem) => void | typeof TransacaoClienteItem {
    throw new Error('Function not implemented.');
}