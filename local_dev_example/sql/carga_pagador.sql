INSERT INTO public.pagador (id, "nomeEmpresa", agencia, "dvAgencia", conta, "dvConta", logradouro, numero, complemento, bairro, cidade, cep, "complementoCep", uf, "cpfCnpj") VALUES (1, 'CONTA BILHETAGEM – CB', '4064', '9', '000600071084', '8', 'R DONA MARIANA', '00048', 'ANDAR 7', 'CENTRO', 'Rio de Janeiro', '22280', '020', 'RJ', '546037000110');
INSERT INTO public.pagador (id, "nomeEmpresa", agencia, "dvAgencia", conta, "dvConta", logradouro, numero, complemento, bairro, cidade, cep, "complementoCep", uf, "cpfCnpj") VALUES (2, 'CETT CTA ESTAB TARIFARIA TRANSP', '4064', '9', '000600071083', '0', 'R DONA MARIANA', '00048', 'ANDAR 7', 'CENTRO', 'Rio de Janeiro', '22280', '020', 'RJ', '546037000110');


SELECT pg_catalog.setval('public.pagador_id_seq', 2, true);