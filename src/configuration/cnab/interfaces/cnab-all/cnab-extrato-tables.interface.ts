import { DeepPartial } from 'typeorm';
import { ExtratoHeaderArquivo } from '../../../../domain/entity/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from '../../../../domain/entity/extrato-header-lote.entity';
import { CnabRegistros104Extrato } from '../cnab-240/104/extrato/cnab-registros-104-extrato.interface';

export interface ICnabExtratoTables {
  headerArquivo: DeepPartial<ExtratoHeaderArquivo>;
  lotes: {
    headerLote: DeepPartial<ExtratoHeaderLote>;
    detalhes: {
      registroExtrato: CnabRegistros104Extrato,
    }[];
  }[];
}
