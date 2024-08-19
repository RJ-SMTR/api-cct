import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 *
 * @version v032 micro - FEV/2024
 *
 * @extends {CnabFields}
 */
export interface CnabDetalheZ_104 {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  usoExclusivoFebraban: CnabField;
  /**
   * Z.07 - Autenticação para atender Legislação
   *
   * Número do Comprovante de Pagamento gerado após a efetivação do Débito em Conta ou Autenticação Bancária / Protocolo.
   */
  comprovanteAutenticacao: CnabField;
  /**
   * Z.08 - Ocorrências
   */
  usoExclusivoFebraban2: CnabField;
}
