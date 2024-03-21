import { HeaderArquivoDTO } from '../dto/pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from '../dto/pagamento/header-lote.dto';
import { ItemTransacao } from '../entity/intermediate/item-transacao.entity';
import { Transacao } from '../entity/intermediate/transacao.entity';
import { ICnab240_104RegistroAB } from './cnab-240/104/cnab-240-104-registro-a-b.interface';

export interface ICnabTables {
  transacao: Transacao,
  headerArquivo: HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLoteDTO;
    detalhes: {
      itemTransacao: ItemTransacao,
      registroAB: ICnab240_104RegistroAB,
    }[];
  }[];
}
