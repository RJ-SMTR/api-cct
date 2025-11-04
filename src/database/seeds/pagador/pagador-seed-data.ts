import { Pagador } from "src/domain/entity/pagador.entity";
import { PagadorContaEnum } from "src/domain/enum/pagador.enum";

export const pagadorSeedData: Pagador[] = [
  new Pagador({
    id: 1,
    nomeEmpresa: 'CONTA BILHETAGEM – CB',
    agencia: '4064',
    dvAgencia: '9',
    conta: PagadorContaEnum.ContaBilhetagem,
    dvConta: '8',
    logradouro: 'R DONA MARIANA',
    numero: '00048',
    complemento: 'ANDAR 7',
    bairro: 'CENTRO',
    cidade: 'Rio de Janeiro',
    cep: '22280',
    complementoCep: '020',
    uf: 'RJ',
    cpfCnpj: '546037000110',
  }),
  new Pagador({
    id: 2,
    nomeEmpresa: 'CETT CTA ESTAB TARIFARIA TRANSP',
    agencia: '4064',
    dvAgencia: '9',
    conta: PagadorContaEnum.CETT,
    dvConta: '0',
    logradouro: 'R DONA MARIANA',
    numero: '00048',
    complemento: 'ANDAR 7',
    bairro: 'CENTRO',
    cidade: 'Rio de Janeiro',
    cep: '22280',
    complementoCep: '020',
    uf: 'RJ',
    cpfCnpj: '546037000110',
  }),
];