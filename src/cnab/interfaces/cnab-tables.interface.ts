import { HeaderArquivoDTO } from '../dto/pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from '../dto/pagamento/header-lote.dto';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Transacao } from '../entity/pagamento/transacao.entity';
import { CnabRegistros104Pgto } from './cnab-240/104/pagamento/cnab-registros-104-pgto.interface';

export interface ICnabTables {
  transacao: Transacao,
  headerArquivo: HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLoteDTO;
    detalhes: {
      itemTransacao: ItemTransacao,
      registroAB: CnabRegistros104Pgto,
    }[];
  }[];
}
