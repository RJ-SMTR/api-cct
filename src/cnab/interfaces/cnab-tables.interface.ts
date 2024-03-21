import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { HeaderLoteDTO } from '../dto/header-lote.dto';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { Transacao } from '../entity/transacao.entity';
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
