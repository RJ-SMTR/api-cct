import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabDetalheB_104 } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';

/**
 * Pagamento de títulos da CAIXA, títulos de Outros Bancos e Pix QR Code.
 * 
 * @version v035 micro - 2024/09
 */
export const cnabDetalheJ104Template: CnabDetalheB_104 = {
  /** B.01 */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d() },
  /** B.02 */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000', ...Cnab.insert.d() },
  /** B.03 */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    ...Cnab.insert.number(),
  },
  /** B.04 */
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000', ...Cnab.insert.number() },
  /** B.05 */
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.B,
    ...Cnab.insert.string(),
  },
  /** B.06 */
  usoExclusivoFebraban: { pos: [15, 17], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  /** B.07 - CPF se favorecido = cpf, senão CNPJ */
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '0', ...Cnab.insert.d() },
  /** B.08 - Favorecido.cpfCnpj */
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
    ...Cnab.insert.d(),
  },
  /** 
   * B.09 - Preencher com o nome da Rua, Avenida, Alameda. Retornado conforme recebido. 
   * 
   * "Branco"
   */
  logradouro: {
    pos: [33, 62],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d(),
  },
  /** B.10 - Zeros */
  numeroLocal: { pos: [63, 67], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** B.11 - Branco */
  complemento: { pos: [68, 82], picture: 'X(015)', value: '               ', ...Cnab.insert.d() },
  /** B.12 - Branco */
  bairro: { pos: [83, 97], picture: 'X(015)', value: '               ', ...Cnab.insert.d() },
  /** B.13 - Branco */
  cidade: { pos: [98, 117], picture: 'X(020)', value: '                    ', ...Cnab.insert.d() },
  /** B.14 - Branco */
  cep: { pos: [118, 122], picture: '9(005)', value: '00000', ...Cnab.insert.d() },
  /** B.15 - Branco */
  complementoCep: { pos: [123, 125], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  /** B.16 - Branco */
  siglaEstado: { pos: [126, 127], picture: 'X(002)', value: '  ', ...Cnab.insert.d() },
  /** B.17 - DDMMAAAA - transacao.datetime_processamento */
  dataVencimento: {
    pos: [128, 135], picture: '9(008)', value: '00000000',
    format: Cnab.format.dateFormat(),
    ...Cnab.insert.d(),
  },
  /** B.18 - Zeros */
  valorDocumento: {
    pos: [136, 150],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  /** B.19 - Zeros */
  valorAbatimento: {
    pos: [151, 165],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  /** B.20 - Zeros */
  valorDesconto: {
    pos: [166, 180],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  /** B.21 - Zeros */
  valorMora: {
    pos: [181, 195],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  /** B.22 - Zeros */
  valorMulta: {
    pos: [196, 210],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  /** B.23 - Branco */
  codigoDocumentoFavorecido: {
    pos: [211, 225],
    picture: 'X(015)',
    value: '               ',
    ...Cnab.insert.d(),
  },
  /** B.24 - Branco */
  usoExclusivoFebraban2: {
    pos: [226, 240],
    picture: 'X(015)',
    value: '               ',
    ...Cnab.insert.d(),
  },
};
