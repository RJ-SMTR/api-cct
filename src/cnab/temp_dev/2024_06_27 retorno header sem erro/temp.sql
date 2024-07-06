-- Active: 1719265207126@@127.0.0.1@3306
select *
from br_rj_riodejaneiro_bilhetagem.ordem_pagamento_consorcio_operador_dia o
WHERE o.id_operadora = '463416372'
order by o.data_ordem ASC

SELECT
    CAST(t.data_ordem AS STRING) AS dataOrdem,
    t.id_consorcio AS idConsorcio,
    t.consorcio,
    t.id_operadora AS idOperadora,
    t.operadora AS operadora,
    t.id_ordem_pagamento AS idOrdemPagamento,
    t.quantidade_transacao_debito AS quantidadeTransacaoDebito,
    t.valor_debito AS valorDebito,
    t.quantidade_transacao_especie AS quantidadeTransacaoEspecie,
    t.valor_especie AS valorEspecie,
    t.quantidade_transacao_gratuidade AS quantidadeTransacaoGratuidade,
    t.valor_gratuidade AS valorGratuidade,
    t.quantidade_transacao_integracao AS quantidadeTransacaoIntegracao,
    t.valor_integracao AS valorIntegracao,
    t.quantidade_transacao_rateio_credito AS quantidadeTransacaoRateioCredito,
    t.valor_rateio_credito AS valorRateioCredito,
    t.quantidade_transacao_rateio_debito AS quantidadeTransacaoRateioDebito,
    t.valor_rateio_debito AS valorRateioDebito,
    t.valor_total_transacao_bruto AS valorTotalTransacaoBruto,
    t.valor_desconto_taxa AS valorDescontoTaxa,
    t.valor_total_transacao_liquido AS valorTotalTransacaoLiquido,
    t.versao AS versao,
    o.tipo_documento AS operadoraTipoDocumento,
    CAST(c.cnpj AS STRING) AS consorcioCnpj,
    CAST(o.documento AS STRING) AS operadoraCpfCnpj,
FROM
    `rj-smtr.br_rj_riodejaneiro_bilhetagem.ordem_pagamento_consorcio_operador_dia` t
    LEFT JOIN `rj-smtr.cadastro.operadoras` o ON o.id_operadora = t.id_operadora
    LEFT JOIN `rj-smtr.cadastro.consorcios` c ON c.id_consorcio = t.id_consorcio
WHERE
    t.data_ordem BETWEEN '2024-06-07'
    AND '2024-06-13'
    AND o.tipo_documento = 'CPF'
    AND t.valor_total_transacao_liquido > 0
    AND t.id_operadora IN (
'463416372','463416372','463416372','463453401','463422751','463453085','463423222','463413106','463516487','463413258','463453182','463494930','463553996','463553589','463452921','463423091','463554555','463575620','463556092','463572898','463423161','463513752','463573350','463565416','463423170','463554591','463415449'
    )
ORDER BY
    dataOrdem ASC,
    idConsorcio ASC