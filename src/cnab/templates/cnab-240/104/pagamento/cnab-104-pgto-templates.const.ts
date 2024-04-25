import { CnabFile104 } from "src/cnab/interfaces/cnab-240/104/cnab-file-104.interface";
import { getCnabFileFrom104 } from "src/cnab/utils/cnab/cnab-104-pipe-utils";
import { setCnabFileMetadata } from "src/cnab/utils/cnab/cnab-metadata-utils";
import { CnabHeaderArquivo104Template } from "../cnab-header-arquivo-104-template.const";
import { cnabTrailerArquivo104Template } from "../cnab-trailer-arquivo-104-template.const";
import { cnabTrailerLote104Template } from "../cnab-trailer-lote-104-template.const";
import { cnabDetalheA104Template } from "./cnab-detalhe-a-104-template.const";
import { cnabDetalheB104Template } from "./cnab-detalhe-b-104-template.const";
import { cnabHeaderLote104PgtoTemplate } from "./cnab-header-lote-104-pgto-template.const";

const sc = structuredClone;

const registros = {
  headerArquivo: sc(CnabHeaderArquivo104Template),
  headerLote: sc(cnabHeaderLote104PgtoTemplate),
  detalheA: sc(cnabDetalheA104Template),
  detalheB: sc(cnabDetalheB104Template),
  trailerLote: sc(cnabTrailerLote104Template),
  trailerArquivo: sc(cnabTrailerArquivo104Template),
};
const pgtoFile104: CnabFile104 = {
  _metadata: { type: 'CnabFile104' },
  headerArquivo: sc(CnabHeaderArquivo104Template),
  lotes: [{
    headerLote: sc(registros.headerLote),
    registros: [{
      detalheA: sc(registros.detalheA),
      detalheB: sc(registros.detalheB),
    }],
    trailerLote: sc(registros.trailerLote),
  }],
  trailerArquivo: sc(registros.trailerArquivo),
};

const pgtoRetFile104 = sc(pgtoFile104);

setCnabFileMetadata(pgtoRetFile104, 'CnabPgtoRet');

const pgtoRetFile = getCnabFileFrom104(pgtoRetFile104);

export const Cnab104PgtoTemplates = {
  file: {
    /** With Metadata */
    dto: {
      retorno: pgtoRetFile
    }
  },
  file104: {
    /** No Metadata */
    raw: pgtoFile104,
    registros: registros,
  },
}
