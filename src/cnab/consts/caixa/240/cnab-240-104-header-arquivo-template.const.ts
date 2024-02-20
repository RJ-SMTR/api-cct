import { ICnab240CaixaHeaderArquivo } from 'src/cnab/interfaces/cnab-240/104/cnab-240-104-header-arquivo.interface';

export const cnab240_104HeaderArquivoTemplate: ICnab240CaixaHeaderArquivo = {
  codigoBanco: {
    pos: [1, 3],
    picture: '9(003)',
    value: '104',
  },
  loteServico: {
    pos: [4, 7],
    picture: '9(004)',
    value: '0000',
  },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: '0',
  },
  filler: {
    pos: [9, 17],
    picture: 'X(009)',
    value: '         ',
  },
  tipoInscricao: {
    pos: [18, 18],
    picture: '9(001)',
    value: '0',
  },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '00000000000000',
  },
  codigoConvenioBanco: {
    pos: [33, 38],
    picture: '9(006)',
    value: '000000',
  },
  parametroTransmissao: {
    pos: [39, 40],
    picture: '9(002)',
    value: '00',
  },
  ambienteCliente: {
    pos: [41, 41],
    picture: 'X(001)',
    value: 'T',
  },
  ambienteCaixa: {
    pos: [42, 42],
    picture: 'X(001)',
    value: ' ',
  },
  origemAplicativo: {
    pos: [43, 45],
    picture: 'X(003)',
    value: '   ',
  },
  numeroVersao: {
    pos: [46, 49],
    picture: '9(004)',
    value: '0000',
  },
  filler2: {
    pos: [50, 52],
    picture: 'X(003)',
    value: '   ',
  },
  agenciaContaCorrente: {
    pos: [53, 57],
    picture: '9(005)',
    value: '00000',
  },
  dvAgencia: {
    pos: [58, 58],
    picture: '9(001)',
    value: '0',
  },
  dvConta: {
    pos: [71, 71],
    picture: 'X(001)',
    value: ' ',
  },
  dvAgenciaConta: {
    pos: [72, 72],
    picture: 'X(001)',
    value: ' ',
  },
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
  },
  nomeBanco: {
    pos: [103, 132],
    picture: 'X(030)',
    value: 'CAIXA                         ',
  },
  filler3: {
    pos: [133, 142],
    picture: 'X(010)',
    value: '          ',
  },
  tipoArquivo: {
    pos: [143, 143],
    picture: '9(001)',
    value: '1',
  },
  dataGeracaoArquivo: {
    pos: [144, 151],
    picture: '9(008)',
    value: '',
  },
  horaGeracaoArquivo: {
    pos: [152, 157],
    picture: '9(006)',
    value: '',
  },
  nsa: {
    pos: [158, 163],
    picture: '9(006)',
    value: '',
  },
  versaoLeiauteArquivo: {
    pos: [164, 166],
    picture: '9(003)',
    value: '080',
  },
  densidadeGravacao: {
    pos: [167, 171],
    picture: '9(005)',
    value: '01600',
  },
  reservadoBanco: {
    pos: [172, 191],
    picture: 'X(020)',
    value: '                    ',
  },
  reservadoEmpresa: {
    pos: [192, 211],
    picture: 'X(020)',
    value: '                    ',
  },
  usoExclusivoFebraban: {
    pos: [212, 222],
    picture: 'X(011)',
    value: '           ',
  },
  identidadeCobranca: {
    pos: [223, 225],
    picture: 'X(003)',
    value: '   ',
  },
  usoExclusivoVan: {
    pos: [226, 228],
    picture: '9(003)',
    value: '00',
  },
  tipoServico: {
    pos: [229, 230],
    picture: 'X(002)',
    value: '  ',
  },
  ocorrenciaCobrancaSemPapel: {
    pos: [231, 240],
    picture: 'X(010)',
    value: '          ',
  },
};
