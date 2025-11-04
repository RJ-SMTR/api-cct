import { Metadata } from 'src/utils/interfaces/metadata.type';
import { CnabFile104 } from '../cnab-file-104.interface';
import { CnabHeaderArquivo104, CnabHeaderArquivo104DTO } from '../../../../dto/cnab-240/104/cnab-header-arquivo-104.dto';
import { CnabTrailerArquivo104 } from '../cnab-trailer-arquivo-104.interface';
import { CnabLote104Pgto } from './cnab-lote-104-pgto.interface';
import { HeaderArquivoDTO } from 'src/domain/dto/header-arquivo.dto';
import { HeaderArquivo } from 'src/domain/entity/header-arquivo.entity';
import { HeaderLoteDTO } from 'src/domain/dto/header-lote.dto';
import { Cnab104TipoMovimento } from 'src/configuration/cnab/enums/104/cnab-104-tipo-movimento.enum';
import { Cnab104PgtoTemplates } from 'src/configuration/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { CnabHeaderLote104PgtoDTO } from './cnab-header-lote-104-pgto.interface';

export interface CnabFile104Pgto extends CnabFile104 {
  _metadata?: Metadata;
  headerArquivo: CnabHeaderArquivo104;
  lotes: CnabLote104Pgto[];
  trailerArquivo: CnabTrailerArquivo104;
}

export class CnabFile104PgtoDTO implements CnabFile104Pgto {
  constructor(dto: CnabFile104Pgto) {
    Object.assign(this, dto);
  }
  _metadata?: Metadata;
  headerArquivo: CnabHeaderArquivo104;
  lotes: CnabLote104Pgto[];
  trailerArquivo: CnabTrailerArquivo104;

  static fromDTO(args: {
    headerArquivoDTO: HeaderArquivoDTO;
    headerLoteDTOs: HeaderLoteDTO[];
    isCancelamento?: boolean;
    isTeste?: boolean;
    dataCancelamento?: Date;
  }): CnabFile104PgtoDTO | null {
    const { headerArquivoDTO, headerLoteDTOs, isTeste } = args;
    const isCancelamento = Boolean(args.isCancelamento);
    const dataCancelamento = args?.dataCancelamento || new Date();

    const headerArquivo104 = CnabHeaderArquivo104DTO.fromDTO(headerArquivoDTO, isTeste);
    const trailerArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.trailerArquivo);
    const cnab104 = new CnabFile104PgtoDTO({
      headerArquivo: headerArquivo104,
      lotes: headerLoteDTOs.map((headerLote) => ({
        headerLote: CnabHeaderLote104PgtoDTO.fromDTO(headerLote),
        registros: headerLote.registros104,
        trailerLote: structuredClone(Cnab104PgtoTemplates.file104.registros.trailerLote),
      })),
      trailerArquivo: trailerArquivo104,
    });

    cnab104.lotes = cnab104.lotes.filter((l) => l.registros.length > 0);
    if (!cnab104.lotes.length) {
      return null;
    }

    if (isCancelamento) {
      cnab104.lotes.forEach((l) => {
        l.registros.forEach((r) => {
          r.detalheA.tipoMovimento.value = Cnab104TipoMovimento.Exclusao;
          r.detalheA.dataVencimento.value = dataCancelamento;
          r.detalheB.dataVencimento.value = dataCancelamento;
        });
      });
    }

    return cnab104;
  }
}
