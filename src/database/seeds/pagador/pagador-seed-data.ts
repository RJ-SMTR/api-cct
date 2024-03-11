import { Pagador } from "src/cnab/entity/pagador.entity";
import { PagadorContaEnum } from "src/cnab/enums/pagador/pagador.enum";

export const pagadorSeedData: Pagador[] = [
  new Pagador({
    id: 1,
    nomeEmpresa: 'PREFEITURA DO RIO 2',
    agencia: '1234',
    dvAgencia: '',
    conta: PagadorContaEnum.JAE,
    dvConta: '',
    logradouro: 'RUA ABC',
    numero: '123',
    complemento: 'BLOCO C',
    bairro: 'CENTRO',
    cidade: 'RIO DE JANEIRO',
    cep: '12345',
    complementoCep: '678',
    uf: '',
    cpfCnpj: '81783423000127',
  })
];