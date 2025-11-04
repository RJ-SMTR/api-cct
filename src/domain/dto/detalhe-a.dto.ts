import { IsNotEmpty, ValidateIf } from 'class-validator';
import { startOfDay } from 'date-fns';
import { DetalheA } from 'src/domain/entity/detalhe-a.entity';
import { ItemTransacaoAgrupado } from 'src/domain/entity/item-transacao-agrupado.entity';
import { Ocorrencia } from 'src/domain/entity/ocorrencia.entity';
import { CnabDetalheA_104 } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabHeaderLote104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { getCnabFieldConverted } from 'src/configuration/cnab/utils/cnab/cnab-field-utils';
import { getDateFromCnabName } from 'src/utils/date-utils';
import { DeepPartial } from 'typeorm';
import { HeaderLote } from '../entity/header-lote.entity';
import { OrdemPagamentoAgrupadoHistorico } from 'src/domain/entity/ordem-pagamento-agrupado-historico.entity';
import { CnabHeaderArquivo104 } from 'src/configuration/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto';

function isCreate(object: DetalheADTO): boolean {
  return object.id === undefined;
}

export class DetalheADTO {
  constructor(dto?: DetalheADTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  static fromRemessa(detalheA: CnabDetalheA_104, existing: DetalheA | null, headerLoteId: number,itemTransacaoAg?: ItemTransacaoAgrupado, historico?: OrdemPagamentoAgrupadoHistorico) {
    return new DetalheADTO({
      ...(existing ? { id: existing.id } : {}),
      nsr: Number(detalheA.nsr.value),
      ocorrenciasCnab: detalheA.ocorrencias.value.trim(),
      dataVencimento: startOfDay(getCnabFieldConverted(detalheA.dataVencimento)),
      tipoMoeda: detalheA.tipoMoeda.value,
      finalidadeDOC: detalheA.finalidadeDOC.value,
      indicadorBloqueio: detalheA.indicadorBloqueio.value,
      numeroDocumentoBanco: detalheA.numeroDocumentoBanco.value,
      quantidadeParcelas: Number(detalheA.quantidadeParcelas.value),
      numeroDocumentoEmpresa: Number(detalheA.numeroDocumentoEmpresa.value),
      quantidadeMoeda: Number(detalheA.quantidadeMoeda.value),
      valorLancamento: getCnabFieldConverted(detalheA.valorLancamento),
      valorRealEfetivado: getCnabFieldConverted(detalheA.valorRealEfetivado),
      periodoVencimento: startOfDay(detalheA.dataVencimento.convertedValue),
      loteServico: getCnabFieldConverted(detalheA.loteServico),
      indicadorFormaParcelamento: getCnabFieldConverted(detalheA.indicadorFormaParcelamento),
      numeroParcela: getCnabFieldConverted(detalheA.numeroParcela),
      dataEfetivacao: getCnabFieldConverted(detalheA.dataEfetivacao),
      headerLote: { id: headerLoteId },
      ordemPagamentoAgrupadoHistorico: historico,
      itemTransacaoAg: itemTransacaoAg
    });
  }

  static newRetornoPagamento(detalheA: DetalheA, headerArq: CnabHeaderArquivo104, headerLotePgto: CnabHeaderLote104Pgto, r: CnabRegistros104Pgto, dataEfetivacao: Date, retornoName: string) {
    return new DetalheADTO({
      id: detalheA.id,
      loteServico: Number(r.detalheA.loteServico.value),
      finalidadeDOC: r.detalheA.finalidadeDOC.value,
      numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
      dataVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
      dataEfetivacao: dataEfetivacao,
      tipoMoeda: r.detalheA.tipoMoeda.value,
      quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
      valorLancamento: r.detalheA.valorLancamento.convertedValue,
      numeroDocumentoBanco: String(r.detalheA.numeroDocumentoBanco.convertedValue),
      quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
      indicadorBloqueio: r.detalheA.indicadorBloqueio.value,
      indicadorFormaParcelamento: r.detalheA.indicadorFormaParcelamento.stringValue,
      periodoVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
      numeroParcela: r.detalheA.numeroParcela.convertedValue,
      valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
      nsr: Number(r.detalheA.nsr.value),
      ocorrenciasCnab: r.detalheA.ocorrencias.value.trim() || headerLotePgto.ocorrencias.value.trim() || headerArq.ocorrenciaCobrancaSemPapel.value.trim(),
      retornoName,
      retornoDatetime: getDateFromCnabName(retornoName),
    });
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerLote?: DeepPartial<HeaderLote>;

  ocorrencias?: Ocorrencia[];

  ocorrenciasCnab?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  finalidadeDOC?: string | null;

  /** Automático, sequencial. */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroDocumentoEmpresa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoMoeda?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeMoeda?: number | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorLancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroDocumentoBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeParcelas?: number | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorBloqueio?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorFormaParcelamento?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  periodoVencimento?: Date | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroParcela?: number | null;

  dataEfetivacao?: Date | null;

  valorRealEfetivado?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  ordemPagamentoAgrupadoHistorico?: OrdemPagamentoAgrupadoHistorico;

  itemTransacaoAg?: ItemTransacaoAgrupado;

  retornoName?: string | null;
  retornoDatetime?: Date | null;
}
