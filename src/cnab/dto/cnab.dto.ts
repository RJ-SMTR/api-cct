import { ItemTransacao } from '../entity/item-transacao.entity';
import { HeaderArquivoDTO } from './header-arquivo.dto';
import { HeaderLoteDTO } from './header-lote.dto';

export class CnabDto {
  headerArquivo = HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLoteDTO;
    detalhes: ItemTransacao[];
  }[];
}
