import { Cnab104Const } from 'src/cnab/const/cnab-104.const';
import { Cnab104CodigoSegmento } from 'src/cnab/enums/104/cnab-104-codigo-segmento.enum';
import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { ICnab240_104DetalheB } from 'src/cnab/interfaces/cnab-240/104/cnab-240-104-detalhe-b.interface';

export const cnab240_104DetalheBTemplate: ICnab240_104DetalheB = {
  codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
  loteServico: { pos: [4, 7], picture: '9(004)', value: '0000' },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabAllCodigoRegistro.DetalheSegmento,
  },
  nsr: { pos: [9, 13], picture: '9(005)', value: '00000' },
  codigoSegmento: {
    pos: [14, 14],
    picture: 'X(001)',
    value: Cnab104CodigoSegmento.B,
  },
  usoExclusivoFebraban: { pos: [15, 17], picture: 'X(003)', value: '   ' },
  tipoInscricao: { pos: [18, 18], picture: '9(001)', value: '0' },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
  },
  logradouro: {
    pos: [33, 62],
    picture: 'X(030)',
    value: '                              ',
  },
  numeroLocal: { pos: [63, 67], picture: '9(005)', value: '00000' },
  complemento: { pos: [68, 82], picture: 'X(015)', value: '               ' },
  bairro: { pos: [83, 97], picture: 'X(015)', value: '               ' },
  cidade: { pos: [98, 117], picture: 'X(020)', value: '                    ' },
  cep: { pos: [118, 122], picture: '9(005)', value: '00000' },
  complementoCep: { pos: [123, 125], picture: 'X(003)', value: '   ' },
  siglaEstado: { pos: [126, 127], picture: 'X(002)', value: '  ' },
  /** DDMMAAAA */
  dataVencimento: {
    pos: [128, 135], picture: '9(008)', value: '00000000',
    dateFormat: { output: Cnab104Const.dateOutput }
  },
  valorDocumento: {
    pos: [136, 150],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  valorAbatimento: {
    pos: [151, 165],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  valorDesconto: {
    pos: [166, 180],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  valorMora: {
    pos: [181, 195],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  valorMulta: {
    pos: [196, 210],
    picture: '9(013)V99',
    value: '000000000000000',
  },
  codigoDocumentoFavorecido: {
    pos: [211, 225],
    picture: 'X(015)',
    value: '               ',
  },
  usoExclusivoFebraban2: {
    pos: [226, 240],
    picture: 'X(015)',
    value: '               ',
  },
};
