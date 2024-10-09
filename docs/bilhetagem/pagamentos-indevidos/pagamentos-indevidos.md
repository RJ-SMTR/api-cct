# Bilhetagem - Pagamentos indevidos

## Sobre

Enquanto tínhamos em produção o geração de remessa, eventualmente o sistema gerou valores a mais, de forma indevida ([#488](https://github.com/RJ-SMTR/api-cct/issues/488))

## Solução para esses casos

### Armazenar valores excedentes em uma tabela

Criamos uma tabela chamada **pagamento_indevido**, que terá os valores que os vanzeiros receberam a mais.

Toda vez que surigr uma nova Ordem de Pagamento, primeiro o valor a ser recebido será debitado dos Pagamentos Indevidos. Se após o débito houver algum valor a ser pago, só então será retirado dos fundos da Prefeitura.

### Exibir uma mensagem para os pagamentos retirado dos Pagamentos Indevidos

- `T1` - Pagamento indevido
