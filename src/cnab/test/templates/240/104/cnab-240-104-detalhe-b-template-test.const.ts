import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabCodigoSegmento } from 'src/cnab/enums/all/cnab-codigo-segmento.enum';
import { CnabDetalheB_104 } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';

export const cnab240_104DetalheBTemplateTest: CnabDetalheB_104 = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104', ...Cnab.insert.d(), },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0001', ...Cnab.insert.d(), },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.DetalheSegmento,
    ...Cnab.insert.number(),
  },
  nsr: { pos: [9, 13], picture: '9(005)', value: '00002', ...Cnab.insert.number(), },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: CnabCodigoSegmento.B,
    ...Cnab.insert.string(),
  },
  usoExclusivoFebraban: { pos: [15, 17], picture: 'X(003)', value: '   ', ...Cnab.insert.d(), },
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: ' ', ...Cnab.insert.d(), },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '              ',
    ...Cnab.insert.d(),
  },
  logradouro: {
    pos: [33, 62],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.d(),
  },
  numeroLocal: { pos: [63, 67], picture: '9(005)', value: '00104', ...Cnab.insert.d(), },
  complemento: { pos: [68, 82], picture: 'X(015)', value: 'APTO 315       ', ...Cnab.insert.d(), },
  bairro: { pos: [83, 97], picture: 'X(015)', value: 'CENTRO         ', ...Cnab.insert.d(), },
  cidade: { pos: [98, 117], picture: 'X(020)', value: 'RIO DE JANEIRO      ', ...Cnab.insert.d(), },
  cep: { pos: [118, 122], picture: '9(005)', value: '22544', ...Cnab.insert.d(), },
  complementoCep: { pos: [123, 125], picture: 'X(003)', value: '010', ...Cnab.insert.d(), },
  siglaEstado: { pos: [126, 127], picture: 'X(002)', value: 'RJ', ...Cnab.insert.d(), },
  dataVencimento: {
    pos: [128, 135],
    picture: '9(008)',
    value: '06022023',
    ...Cnab.insert.date(),
  },
  valorDocumento: {
    pos: [136, 150],
    picture: '9(013)V99',
    value: 1200.12,
    ...Cnab.insert.d(),
  },
  valorAbatimento: {
    pos: [151, 165],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  valorDesconto: {
    pos: [166, 180],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  valorMora: { pos: [181, 195], picture: '9(013)V99', value: '              ', ...Cnab.insert.d(), },
  valorMulta: {
    pos: [196, 210],
    picture: '9(013)V99',
    value: '000000000000000',
    ...Cnab.insert.d(),
  },
  codigoDocumentoFavorecido: {
    pos: [211, 225],
    picture: 'X(015)',
    value: '               ',
    ...Cnab.insert.d(),
  },
  usoExclusivoFebraban2: {
    pos: [226, 240],
    picture: 'X(015)',
    value: '               ',
    ...Cnab.insert.d(),
  },
};
