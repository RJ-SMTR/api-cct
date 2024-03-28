import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabHeaderLote104Extrato {
  codigoBanco: CnabField,
  loteServico: CnabFieldAs<number>,
  codigoRegistro: CnabFieldAs<number>,
  tipoOperacao: CnabField,
  tipoServico: CnabField,
  formaLancamento: CnabField,
  versaoLeiauteLote: CnabField,
  usoExclusivoFebraban: CnabField,
  /** Cliente */
  tipoInscricao: CnabField,
  /** Cpf/Cnpj cliente */
  numeroInscricao: CnabField,
  /** Código empresa banco */
  codigoConvenioBanco: CnabField,
  /** agencia Mantenedora Conta */
  agencia: CnabField,
  dVAgencia: CnabField,
  conta: CnabField,
  dvConta: CnabField,
  dvAgenciaConta: CnabField,
  nomeEmpresa: CnabField,
  usoExclusivoFebraban2: CnabField,
  dataSaldoInicial: CnabFieldAs<Date>,
  valorSaldoInicial: CnabFieldAs<number>,
  situacaoSaldoInicial: CnabField,
  posicaoSaldoInicial: CnabField,
  /** Moeda referenciada no extrato */
  tipoMoeda: CnabField,
  /** Número de sequência do extrato */
  sequenciaExtrato: CnabField,
  usoExclusivoFebraban3: CnabField,

}
