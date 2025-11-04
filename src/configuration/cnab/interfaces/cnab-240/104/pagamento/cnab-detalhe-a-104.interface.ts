import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { DetalheA } from 'src/domain/entity/detalhe-a.entity';
import { CnabField, CnabFieldAs } from 'src/configuration/cnab/interfaces/cnab-all/cnab-field.interface';
import { Cnab104PgtoTemplates } from 'src/configuration/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';

/**
 * @extends {CnabFields}
 */
export interface CnabDetalheA_104 {
  codigoBanco: CnabField;
  loteServico: CnabFieldAs<number>;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  tipoMovimento: CnabField;
  codigoInstrucaoMovimento: CnabField;
  camaraCompensacao: CnabField;
  codigoBancoDestino: CnabField;
  codigoAgenciaDestino: CnabField;
  dvAgenciaDestino: CnabField;
  contaCorrenteDestino: CnabField;
  dvContaDestino: CnabField;
  dvAgenciaContaDestino: CnabField;
  nomeTerceiro: CnabField;
  /** Atribuído pela empresa. Sequencial, automático. */
  numeroDocumentoEmpresa: CnabFieldAs<number>;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabFieldAs<Date>;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabFieldAs<number>;
  valorLancamento: CnabFieldAs<number>;
  /** Preencher com brancos. Retornado com brancos. */
  numeroDocumentoBanco: CnabFieldAs<number>;
  filler2: CnabField;
  /** `1` = à vista */
  quantidadeParcelas: CnabFieldAs<number>;
  indicadorBloqueio: CnabField;
  indicadorFormaParcelamento: CnabField;
  periodoDiaVencimento: CnabField;
  numeroParcela: CnabFieldAs<number>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  dataEfetivacao: CnabFieldAs<Date | null>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  valorRealEfetivado: CnabFieldAs<number>;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoExclusivoFebraban: CnabField;
  /**  */
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}

/**
 * @extends {CnabFields}
 */
export class CnabDetalheA_104DTO implements CnabDetalheA_104 {
  constructor(dto: CnabDetalheA_104) {
    Object.assign(this, dto);
  }

  static fromEntity(detalheA: DetalheA, favorecido: ClienteFavorecido) {
    const detalheADTO = new CnabDetalheA_104DTO(structuredClone(Cnab104PgtoTemplates.file104.registros.detalheA));
    detalheADTO.codigoBancoDestino.value = favorecido.codigoBanco;
    detalheADTO.codigoAgenciaDestino.value = favorecido.agencia;
    detalheADTO.dvAgenciaDestino.value = favorecido.dvAgencia;
    detalheADTO.contaCorrenteDestino.value = favorecido.contaCorrente;
    detalheADTO.dvContaDestino.value = favorecido.dvContaCorrente;
    detalheADTO.nomeTerceiro.value = favorecido.nome;
    detalheADTO.numeroDocumentoEmpresa.value = detalheA.numeroDocumentoEmpresa;
    detalheADTO.dataVencimento.value = detalheA.dataVencimento;
    detalheADTO.valorLancamento.value = detalheA.valorLancamento;
    detalheADTO.nsr.value = detalheA.nsr;
    return detalheADTO;
  }

  codigoBanco: CnabField;
  loteServico: CnabFieldAs<number>;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  tipoMovimento: CnabField;
  codigoInstrucaoMovimento: CnabField;
  camaraCompensacao: CnabField;
  codigoBancoDestino: CnabField;
  codigoAgenciaDestino: CnabField;
  dvAgenciaDestino: CnabField;
  contaCorrenteDestino: CnabField;
  dvContaDestino: CnabField;
  dvAgenciaContaDestino: CnabField;
  nomeTerceiro: CnabField;
  /** Atribuído pela empresa. Sequencial, automático. */
  numeroDocumentoEmpresa: CnabFieldAs<number>;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabFieldAs<Date>;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabFieldAs<number>;
  valorLancamento: CnabFieldAs<number>;
  /** Preencher com brancos. Retornado com brancos. */
  numeroDocumentoBanco: CnabFieldAs<number>;
  filler2: CnabField;
  /** `1` = à vista */
  quantidadeParcelas: CnabFieldAs<number>;
  indicadorBloqueio: CnabField;
  indicadorFormaParcelamento: CnabField;
  periodoDiaVencimento: CnabField;
  numeroParcela: CnabFieldAs<number>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  dataEfetivacao: CnabFieldAs<Date | null>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  valorRealEfetivado: CnabFieldAs<number>;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoExclusivoFebraban: CnabField;
  /**  */
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}
