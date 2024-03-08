import { ICnab240_104DetalheA } from './cnab-240-104-detalhe-a.interface';
import { ICnab240_104DetalheB } from './cnab-240-104-detalhe-b.interface';

export interface ICnab240_104Registro {
  detalheA?: ICnab240_104DetalheA;
  detalheB?: ICnab240_104DetalheB;
}
