import { Cnab } from 'src/configuration/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/configuration/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabCodigoSegmento } from 'src/configuration/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabDetalheZ_104 } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-z-104.interface';

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 *
 * @version v035 micro - 2024/09 - **CUSTOMIZADO**
 */
export const cnabDetalheZ104Template: CnabDetalheZ_104 = {
  /** Z.01 */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  /** Z.02 */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000', ...Cnab.insert.d() },
  /** Z.03 */
  codigoRegistro: { pos: [8, 8], picture: '9(001)', value: CnabCodigoRegistro.DetalheSegmento, ...Cnab.insert.number() },
  /** Z.04 */
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000', ...Cnab.insert.number() },
  /** Z.05 */
  codigoSegmento: { pos: [14, 14], picture: 'X(001)', value: CnabCodigoSegmento.Z, ...Cnab.insert.string() },
  /**
   * Z.06 - Autenticação para atender Legislação
   *
   * Uso FEBRABAN – enviado com espaços.
   */
  usoExclusivoFebraban: { pos: [15, 78], picture: '9(064)', value: '0'.repeat(64), ...Cnab.insert.d() },
  /**
   * Z.07 - Autenticação Bancária / Protocolo
   *
   * Número do Comprovante de Pagamento gerado após a efetivação do Débito em Conta ou Autenticação Bancária / Protocolo.
   *
   * CUSTOMIZADO: No PDF o picture é 9(025), mas o retorno mostra letras e números. Foi erro deles ou usamos um DetalheZ diferente aqui?
   */
  comprovanteAutenticacao: { pos: [79, 103], picture: 'X(025)', value: ' '.repeat(25), ...Cnab.insert.d() },
  /**
   * Z.08 - Ocorrências
   *
   * Uso exclusivo FEBRABAN – enviado com espaços
   *
   * CUSTOMIZADO: No PDF o picture é 9(000). Eles esqueceram de botar a numeração ou Picture 0 significa _qualquer comprimento_?
   */
  usoExclusivoFebraban2: { pos: [104, 240], picture: '9(137)', value: '0'.repeat(136), ...Cnab.insert.d() },
};
