import { Cnab } from 'src/configuration/cnab/const/cnab.const';
import { CnabCodigoSegmento } from 'src/configuration/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabDetalheE_104V030 as CnabDetalheE_104V030 } from 'src/configuration/cnab/interfaces/cnab-240/104/extrato/cnab-detalhe-e-104-v030.interface';

/**
 * EXTRATO ELETRÔNICO PARA CONCILIAÇÃO BANCÁRIA
 * 
 * @version v005 micro MAIO/2022
 */
export const cnabDetalheE104V030Template: CnabDetalheE_104V030 = {
  /** Fixo: 104 (Caixa) */
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '000', ...Cnab.insert.d() },
  /** Sequencial, automático. */
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000', ...Cnab.insert.number() },
  /** Tipo de Registro  */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: '0',
    ...Cnab.insert.d(),
  },
  /** Automático. Número do registro no lote. */
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000', ...Cnab.insert.number() },
  /** Segmento E */
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.E,
    ...Cnab.insert.string(),
  },
  usoExclusivoFebraban: { pos: [15, 17], picture: 'X(003)', value: '   ', ...Cnab.insert.d() },
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '0', ...Cnab.insert.d() },
  /** CPF/CNPJ */
  numeroInscricao: { pos: [19, 32], picture: '9(014)', value: '0'.repeat(14), ...Cnab.insert.d() },
  codigoConvenioBanco: { pos: [33, 52], picture: 'X(020)', value: ' '.repeat(20), ...Cnab.insert.d() },
  agencia: { pos: [53, 57], picture: '9(005)', value: '     ', ...Cnab.insert.d() },
  dvAgencia: { pos: [58, 58], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  conta: { pos: [59, 70], picture: '9(012)', value: '0'.repeat(12), ...Cnab.insert.d() },
  dvConta: { pos: [71, 71], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  dvAgenciaConta: { pos: [72, 72], picture: 'X(001)', value: '0', ...Cnab.insert.d() },
  nomeEmpresa: { pos: [73, 102], picture: 'X(030)', value: ' '.repeat(30), ...Cnab.insert.string() },
  usoExclusivoFebraban2: { pos: [103, 142], picture: 'X(040)', value: '      ', ...Cnab.insert.d() },
  dataLancamento: {
    pos: [143, 150], picture: '9(008)', value: '00000000',
    ...Cnab.insert.date(),
  },
  valorLancamento: { pos: [151, 168], picture: '9(016)V99', value: '0'.repeat(18), ...Cnab.insert.number() },
  tipoLancamento: { pos: [169, 169], picture: 'X(001)', value: ' ', ...Cnab.insert.d() },
  categoriaLancamento: { pos: [170, 172], picture: '9(003)', value: '000', ...Cnab.insert.d() },
  codigoHistoricoBanco: { pos: [173, 176], picture: 'X(004)', value: '    ', ...Cnab.insert.d() },
  descricaoHistoricoBanco: { pos: [177, 201], picture: 'X(025)', value: ' '.repeat(25), ...Cnab.insert.string() },
  numeroDocumento: { pos: [202, 240], picture: 'X(039)', value: ' '.repeat(39), ...Cnab.insert.d() },
};
