import { ItemTransacao } from '../entity/intermediate/item-transacao.entity';
import { HeaderArquivoDTO } from './pagamento/header-arquivo.dto';
import { HeaderLoteDTO } from './pagamento/header-lote.dto';

export class CnabDto {
  headerArquivo = HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLoteDTO;
    detalhes: ItemTransacao[];
  }[];
}
