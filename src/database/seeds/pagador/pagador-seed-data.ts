import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";
import { PagadorContaEnum } from "src/cnab/enums/pagamento/pagador.enum";

export const pagadorSeedData: Pagador[] = [
  new Pagador({
    id: 1,
    nomeEmpresa: 'CONTA BILHETAGEM – CB',
    agencia: '4064',
    dvAgencia: '0',
    conta: PagadorContaEnum.JAE,
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
    dvAgencia: '0',
    conta: PagadorContaEnum.LANCAMENTO,
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