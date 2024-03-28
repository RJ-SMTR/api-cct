import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';

export const CnabHeaderArquivo104Template: CnabHeaderArquivo104 = {
  codigoBanco: {
    pos: [1, 3],
    picture: '9(003)',
    value: '104',
    ...Cnab.insert.d(),
  },
  loteServico: {
    pos: [4, 7],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.number(),
  },
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.HeaderArquivo,
    ...Cnab.insert.number(),
  },
  filler: {
    pos: [9, 17],
    picture: 'X(009)',
    value: '         ',
    ...Cnab.insert.d(),
  },
  tipoInscricao: {
    pos: [18, 18],
    picture: '9(001)',
    value: '2',
    ...Cnab.insert.d(),
  },
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '546037000110',
    ...Cnab.insert.d(),
  },
  codigoConvenioBanco: {
    pos: [33, 38],
    picture: '9(006)',
    value: '444773',
    ...Cnab.insert.d(),
  },
  parametroTransmissao: {
    pos: [39, 40],
    picture: '9(002)',
    value: '01',
    ...Cnab.insert.d(),
  },
  ambienteCliente: {
    pos: [41, 41],
    picture: 'X(001)',
    value: 'T',
    ...Cnab.insert.d(),
  },
  ambienteCaixa: {
    pos: [42, 42],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  origemAplicativo: {
    pos: [43, 45],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  numeroVersao: {
    pos: [46, 49],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.d(),
  },
  filler2: {
    pos: [50, 52],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  agenciaContaCorrente: {
    pos: [53, 57],
    picture: '9(005)',
    value: '00000',
    ...Cnab.insert.d(),
  },
  dvAgencia: {
    pos: [58, 58],
    picture: '9(001)',
    value: '0',
    ...Cnab.insert.d(),
  },
  numeroConta: {
    pos: [59, 70],
    picture: '9(012)',
    value: '000000000000',
    ...Cnab.insert.d(),
  },
  dvConta: {
    pos: [71, 71],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  dvAgenciaConta: {
    pos: [72, 72],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.string(),
  },
  nomeBanco: {
    pos: [103, 132],
    picture: 'X(030)',
    value: 'CAIXA                         ',
    ...Cnab.insert.string(),
  },
  filler3: {
    pos: [133, 142],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
  tipoArquivo: {
    pos: [143, 143],
    picture: '9(001)',
    value: '1',
    ...Cnab.insert.number(),
  },
  /** DDMMAAAA */
  dataGeracaoArquivo: {
    pos: [144, 151],
    picture: '9(008)',
    value: '00000000',
    ...Cnab.insert.date(),
  },
  /** HHMMSS */
  horaGeracaoArquivo: {
    pos: [152, 157],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.time(),
  },
  nsa: {
    pos: [158, 163],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.number(),
  },
  versaoLeiauteArquivo: {
    pos: [164, 166],
    picture: '9(003)',
    value: '080',
    ...Cnab.insert.d(),
  },
  densidadeGravacao: {
    pos: [167, 171],
    picture: '9(005)',
    value: '01600',
    ...Cnab.insert.d(),
  },
  reservadoBanco: {
    pos: [172, 191],
    picture: 'X(020)',
    value: '                    ',
    ...Cnab.insert.d(),
  },
  reservadoEmpresa: {
    pos: [192, 211],
    picture: 'X(020)',
    value: '                    ',
    ...Cnab.insert.d(),
  },
  usoExclusivoFebraban: {
    pos: [212, 222],
    picture: 'X(011)',
    value: '           ',
    ...Cnab.insert.d(),
  },
  identidadeCobranca: {
    pos: [223, 225],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  usoExclusivoVan: {
    pos: [226, 228],
    picture: '9(003)',
    value: '000',
    ...Cnab.insert.d(),
  },
  tipoServico: {
    pos: [229, 230],
    picture: 'X(002)',
    value: '  ',
    ...Cnab.insert.d(),
  },
  ocorrenciaCobrancaSemPapel: {
    pos: [231, 240],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
};
