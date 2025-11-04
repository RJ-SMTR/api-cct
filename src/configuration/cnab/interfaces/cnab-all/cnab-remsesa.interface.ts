import { HeaderLote } from 'src/domain/entity/header-lote.entity';
import { HeaderArquivoDTO } from '../../../../domain/dto/header-arquivo.dto';
import { ItemTransacao } from '../../../../domain/entity/item-transacao.entity';
import { Transacao } from '../../../../domain/entity/transacao.entity';
import { CnabRegistros104Pgto } from '../cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { TransacaoAgrupado } from 'src/domain/entity/transacao-agrupado.entity';
import { ItemTransacaoAgrupado } from 'src/domain/entity/item-transacao-agrupado.entity';

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
