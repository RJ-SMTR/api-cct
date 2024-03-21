import { Pagador } from "src/cnab/entity/intermediate/pagador.entity";
import { PagadorContaEnum } from "src/cnab/enums/intermediate/pagador.enum";

export const pagadorSeedData: Pagador[] = [
  new Pagador({
    id: 1,
    nomeEmpresa: 'SECRETARIA MUNICIPAL DE TRANSPORTES - RIO DE JANEIRO',
    agencia: '4064',
    /** TODO: Qual é o dvAgencia? - Anotado  */
    dvAgencia: '0',
    conta: PagadorContaEnum.JAE,
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
  })
];