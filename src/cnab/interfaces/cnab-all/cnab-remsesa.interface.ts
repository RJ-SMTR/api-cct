import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { ItemTransacao } from '../../entity/pagamento/item-transacao.entity';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { CnabRegistros104Pgto } from '../cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';

export interface CnabRemessaDetalhe {
  itemTransacao: ItemTransacao | ItemTransacaoAgrupado,
  registroAB: CnabRegistros104Pgto,
}

/**
 * Contain structured DTOs to save in CNAB pagamento tables
 */
export interface CnabRemessaDTO {
  transacao: Transacao | TransacaoAgrupado,
  headerArquivo: HeaderArquivoDTO;
  lotes: {
    headerLote: HeaderLote;
    detalhes: CnabRemessaDetalhe[];
  }[];
}

export interface CnabRemessa {
  string: string,
  dto: CnabRemessaDTO
}
