/**
 * Regras do teste:
 * 
 * Teste 1:
 * - Geramos 1 CNAB com 1 TransacaoAgrupado, 1 Transacao, 2 ItemTransacaoAgrupado contendo 1 ItemTransacao.
 * - Cada CNAB, como consequência terá 1 HeaderArquivo, 1 HeaderLote
 * - 1 ItemTransacao do agrupado 1 foi feito pagamento com sucesso, 1 do agrupado 2 deu erro de pagamento
 * - TransacaoAgrupado possui:
 *  - dataOrdem = sexta
 * 
 */
// import { ArquivoPublicacao } from "src/cnab/entity/arquivo-publicacao.entity";
// import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";
// import { TransacaoAgrupado } from "src/cnab/entity/pagamento/transacao-agrupado.entity";
// import { TransacaoStatus } from "src/cnab/entity/pagamento/transacao-status.entity";
// import { Transacao } from "src/cnab/entity/pagamento/transacao.entity";
// import { TransacaoStatusEnum } from "src/cnab/enums/pagamento/transacao-status.enum";
// import { LancamentoEntity } from "src/lancamento/lancamento.entity";

// const pagadorMock: Pagador[] = [
//   new Pagador({
//     id: 1,
//     nomeEmpresa: 'CETT',
//     agencia: '0001',
//     dvAgencia: '2',
//     conta: '12345',
//     dvConta: '6',
//     logradouro: '',
//     numero: '',
//     complemento: '',
//     bairro: '',
//     cidade: '',
//     cep: '',
//     complementoCep: '',
//     uf: '',
//     cpfCnpj: '112223334',
//   }),
//   new Pagador({
//     id: 2,
//     nomeEmpresa: 'Conta Bilhetagem',
//     agencia: '0002',
//     dvAgencia: '3',
//     conta: '12346',
//     dvConta: '7',
//     logradouro: '',
//     numero: '',
//     complemento: '',
//     bairro: '',
//     cidade: '',
//     cep: '',
//     complementoCep: '',
//     uf: '',
//     cpfCnpj: '112223335',
//   }),
// ]

// const transacaoMock: Transacao[] = [
//   new Transacao({
//     id: 1,
//     dataOrdem: new Date('2024-06-07'),
//     dataPagamento: new Date('2024-06-07'),
//     idOrdemPagamento: string | null,
//     pagador: Pagador,
//     transacaoAgrupado: TransacaoAgrupado,
//     lancamentos: LancamentoEntity[] | null,
//     itemTransacoes: ItemTransacao[],
//     createdAt: Date,
//     updatedAt: Date,
//   })
// ]

// const transacaoAgMock: TransacaoAgrupado[] = [
//   new TransacaoAgrupado({
//     id: 1,
//     dataOrdem: new Date('2024-06-07'),
//     dataPagamento: new Date('2024-06-07'),
//     idOrdemPagamento: '1',
//     pagador: Pagador,
//     status: TransacaoStatus,
//     lancamentos: null,
//     itemTransacoesAgrupado: [],
//     transacoes: [],
//     createdAt: Date,
//     updatedAt: Date,
//   })
// ];

// const itemTransacao

// export const PublicacaoSeed: ArquivoPublicacao[] = [
//   new ArquivoPublicacao({

//   })
// ]