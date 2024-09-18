import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { FavorecidoEmpresaCpfCnpjEnum, FavorecidoEmpresaNomeEnum } from 'src/cnab/enums/favorecido-empresa.enum';
import { TipoFavorecidoEnum } from 'src/cnab/enums/tipo-favorecido.enum';

export const ClienteFavorecidoSeedData: ClienteFavorecido[] = [
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.VLT,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.VLT,
    codigoBanco: '033',
    agencia: '2271',
    dvAgencia: '',
    contaCorrente: '13098785',
    dvContaCorrente: '7',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.Intersul,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.Intersul,
    codigoBanco: '033',
    agencia: '3003',
    dvAgencia: '',
    contaCorrente: '13080446',
    dvContaCorrente: '4',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.Internorte,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.Internorte,
    codigoBanco: '033',
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13004445',
    dvContaCorrente: '9',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.Transcarioca,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.Transcarioca,
    codigoBanco: '033',
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13010758',
    dvContaCorrente: '7',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.SantaCruz,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.SantaCruz,
    agencia: '3403',
    dvAgencia: '',
    contaCorrente: '13004442',
    dvContaCorrente: '8',
    tipo: TipoFavorecidoEnum.empresa,
  }),
  new ClienteFavorecido({
    nome: FavorecidoEmpresaNomeEnum.SantaCruz,
    cpfCnpj: FavorecidoEmpresaCpfCnpjEnum.SantaCruz,
    codigoBanco: '001',
    agencia: '2234',
    dvAgencia: '9',
    contaCorrente: '296001',
    dvContaCorrente: 'X',
    tipo: TipoFavorecidoEnum.empresa,
  }),
];
