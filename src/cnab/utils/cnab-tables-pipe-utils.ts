import { HeaderArquivoDTO } from "../dto/pagamento/header-arquivo.dto";
import { HeaderLoteDTO } from "../dto/pagamento/header-lote.dto";
import { Transacao } from "../entity/pagamento/transacao.entity";
import { CnabHeaderLote104Pgto } from "../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface";
import { Cnab104PgtoFileTemplates } from "../templates/cnab-240/104/pagamento/cnab-104-pgto-file-templates.const";

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoFileTemplates.file104.registros;

/**
 * From Transacao, HeaderArquivo transforms into HeaderLote.
 */
export function generateHeaderLote(
  transacao: Transacao,
  headerArquivo: HeaderArquivoDTO,
): HeaderLoteDTO {
  const dto = new HeaderLoteDTO({
    codigoConvenioBanco: headerArquivo.codigoConvenio,
    pagador: { id: transacao.pagador.id },
    numeroInscricao: headerArquivo.numeroInscricao,
    parametroTransmissao: headerArquivo.parametroTransmissao,
    tipoCompromisso: String(PgtoRegistros.headerLote.tipoCompromisso.value),
    tipoInscricao: headerArquivo.tipoInscricao,
  });
  return dto;
}


export function asHeaderLote104(
  headerLoteDTO: HeaderLoteDTO,
): CnabHeaderLote104Pgto {
  const headerLote104: CnabHeaderLote104Pgto = sc(PgtoRegistros.headerLote);
  headerLote104.codigoConvenioBanco.value = headerLoteDTO.codigoConvenioBanco;
  headerLote104.numeroInscricao.value = headerLoteDTO.numeroInscricao;
  headerLote104.agenciaContaCorrente.value = headerLoteDTO.numeroInscricao;
  headerLote104.parametroTransmissao.value = headerLoteDTO.parametroTransmissao;
  headerLote104.tipoInscricao.value = headerLoteDTO.tipoInscricao;

  return headerLote104;
}

