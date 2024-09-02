import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { TipoFavorecidoEnum } from 'src/cnab/enums/tipo-favorecido.enum';

/**
 * Favorecidos from
 */
export enum FavorecidoCpfCnpjEnum {
  /** Pagador is CB */
  VLT = '18201378000119',
  Intersul = '12464869000176',
  Internorte = '12464539000180',
  Transcarioca = '12464553000184',
  SantaCruz = '12464577000133',
  CMTC = '12464577000133',
}

export const ClienteFavorecidoSeedData: ClienteFavorecido[] = [
  new ClienteFavorecido({
    nome: 'Concessionária do VLT Carioca S.A.',
    cpfCnpj: '18201378000119',
    codigoBanco: '033',
    agencia: '2271',
    dvAgencia: '',
    contaCorrente: '13098785',
    dvContaCorrente: '7',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: 'Consórcio Intersul Transportes',
    cpfCnpj: '12464869000176',
    codigoBanco: '033',
    agencia: '3003',
    dvAgencia: '',
    contaCorrente: '13080446',
    dvContaCorrente: '4',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: 'Consórcio Internorte de Transportes',
    cpfCnpj: '12464539000180',
    codigoBanco: '033',
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13004445',
    dvContaCorrente: '9',
    tipo: TipoFavorecidoEnum.empresa,
  }),

  new ClienteFavorecido({
    nome: 'Consórcio Transcarioca de Transportes',
    cpfCnpj: '12464553000184',
    codigoBanco: '033',
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13010758',
    dvContaCorrente: '7',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: 'Consórcio Santa Cruz Transportes',
    cpfCnpj: '12464577000133',
    codigoBanco: '033',
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13004442',
    dvContaCorrente: '8',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: 'Companhia Municipal de Transportes Coletivos CMTC Rio',
    cpfCnpj: '44520687000161',
    codigoBanco: '001',
    agencia: '2234',
    dvAgencia: '9',
    contaCorrente: '296001',
    dvContaCorrente: 'X',
    tipo: TipoFavorecidoEnum.empresa,
  }),
];
