import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { HeaderLoteDTO } from '../dto/header-lote.dto';
import { ItemTransacao } from '../entity/item-transacao.entity';

export interface ICnabTables {
  headerArquivo: HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLoteDTO;
    detalhes: ItemTransacao[];
  }[];
}
