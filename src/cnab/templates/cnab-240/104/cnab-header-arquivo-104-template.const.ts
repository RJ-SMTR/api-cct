import { Cnab } from 'src/cnab/const/cnab.const';
import { CnabCodigoRegistro } from 'src/cnab/enums/all/cnab-codigo-registro.enum';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';

/**
 * PAGAMENTO DE SALÁRIOS, PAGAMENTO/CRÉDITO A FORNECEDOR E AUTOPAGAMENTO E DÉBITO AUTOMÁTICO
 * 
 * @version v032 micro - FEV/2024
 * 
 * Requirement: {@Link https://github.com/RJ-SMTR/api-cct/issues/233 #233, GitHub, 24/04/2023}
 */
export const CnabHeaderArquivo104Template: CnabHeaderArquivo104 = {
  /** 0.01 */
  codigoBanco: {
    pos: [1, 3],
    picture: '9(003)',
    value: '104',
    ...Cnab.insert.d(),
  },
  /** 0.02 */
  loteServico: {
    pos: [4, 7],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.number(),
  },
  /** 0.03 */
  codigoRegistro: {
    pos: [8, 8],
    picture: '9(001)',
    value: CnabCodigoRegistro.HeaderArquivo,
    ...Cnab.insert.number(),
  },
  /** 0.04 */
  filler: {
    pos: [9, 17],
    picture: 'X(009)',
    value: '         ',
    ...Cnab.insert.d(),
  },
  /** 0.05 */
  tipoInscricao: {
    pos: [18, 18],
    picture: '9(001)',
    value: '2',
    ...Cnab.insert.d(),
  },
  /** 0.06 */
  numeroInscricao: {
    pos: [19, 32],
    picture: '9(014)',
    value: '546037000110',
    ...Cnab.insert.d(),
  },
  /** 0.07 */
  codigoConvenioBanco: {
    pos: [33, 38],
    picture: '9(006)',
    value: '444773',
    ...Cnab.insert.d(),
  },
  /** 0.08 - Definido pelo banco */
  parametroTransmissao: {
    pos: [39, 40],
    picture: '9(002)',
    value: '01',
    ...Cnab.insert.d(),
  },
  /** 0.09 */
  ambienteCliente: {
    pos: [41, 41],
    picture: 'X(001)',
    value: 'P',
    ...Cnab.insert.d(),
  },
  /** 0.10 */
  ambienteCaixa: {
    pos: [42, 42],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  /** 0.11 */
  origemAplicativo: {
    pos: [43, 45],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  /** 0.12 */
  numeroVersao: {
    pos: [46, 49],
    picture: '9(004)',
    value: '0000',
    ...Cnab.insert.d(),
  },
  /** 0.13 */
  filler2: {
    pos: [50, 52],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  /** 0.14 */
  agenciaContaCorrente: {
    pos: [53, 57],
    picture: '9(005)',
    value: '00000',
    ...Cnab.insert.d(),
  },
  /** 0.15 */
  dvAgencia: {
    pos: [58, 58],
    picture: '9(001)',
    value: '0',
    ...Cnab.insert.d(),
  },
  /** 0.16 */
  numeroConta: {
    pos: [59, 70],
    picture: '9(012)',
    value: '000000000000',
    ...Cnab.insert.d(),
  },
  /** 0.17 */
  dvConta: {
    pos: [71, 71],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  /** 0.18 */
  dvAgenciaConta: {
    pos: [72, 72],
    picture: 'X(001)',
    value: ' ',
    ...Cnab.insert.d(),
  },
  /** 0.19 */
  nomeEmpresa: {
    pos: [73, 102],
    picture: 'X(030)',
    value: '                              ',
    ...Cnab.insert.string(),
  },
  /** 0.20 */
  nomeBanco: {
    pos: [103, 132],
    picture: 'X(030)',
    value: 'CAIXA                         ',
    ...Cnab.insert.string(),
  },
  /** 0.21 */
  filler3: {
    pos: [133, 142],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
  /** 0.22 */
  tipoArquivo: {
    pos: [143, 143],
    picture: '9(001)',
    value: '1',
    ...Cnab.insert.number(),
  },
  /** DDMMAAAA */
  /** 0.23 */
  dataGeracaoArquivo: {
    pos: [144, 151],
    picture: '9(008)',
    value: '00000000',
    ...Cnab.insert.date(),
  },
  /** HHMMSS */
  /** 0.24 */
  horaGeracaoArquivo: {
    pos: [152, 157],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.time(),
  },
  /** 0.25 */
  nsa: {
    pos: [158, 163],
    picture: '9(006)',
    value: '000000',
    ...Cnab.insert.number(),
  },
  /** 0.26 */
  versaoLeiauteArquivo: {
    pos: [164, 166],
    picture: '9(003)',
    value: '080',
    ...Cnab.insert.d(),
  },
  /** 0.27 */
  densidadeGravacao: {
    pos: [167, 171],
    picture: '9(005)',
    value: '01600',
    ...Cnab.insert.d(),
  },
  /** 0.28 */
  reservadoBanco: {
    pos: [172, 191],
    picture: 'X(020)',
    value: '                    ',
    ...Cnab.insert.d(),
  },
  /** 0.29 */
  reservadoEmpresa: {
    pos: [192, 211],
    picture: 'X(020)',
    value: '                    ',
    ...Cnab.insert.d(),
  },
  /** 0.30 */
  usoExclusivoFebraban: {
    pos: [212, 222],
    picture: 'X(011)',
    value: '           ',
    ...Cnab.insert.d(),
  },
  /** 0.31 */
  identidadeCobranca: {
    pos: [223, 225],
    picture: 'X(003)',
    value: '   ',
    ...Cnab.insert.d(),
  },
  /** 0.32 */
  usoExclusivoVan: {
    pos: [226, 228],
    picture: '9(003)',
    value: '000',
    ...Cnab.insert.d(),
  },
  /** 0.33  - preencher com espaço. Retornado com espaço */
  tipoServico: {
    pos: [229, 230],
    picture: 'X(002)',
    value: '  ',
    ...Cnab.insert.d(),
  },
  /** 0.34 */
  ocorrenciaCobrancaSemPapel: {
    pos: [231, 240],
    picture: 'X(010)',
    value: '          ',
    ...Cnab.insert.d(),
  },
};
