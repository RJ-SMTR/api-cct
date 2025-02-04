INSERT INTO public.role (id, name)
VALUES (2, 'User');
INSERT INTO public.role (id, name)
VALUES (1, 'Admin');
INSERT INTO public.role (id, name)
VALUES (0, 'Admin Master');
INSERT INTO public.role (id, name)
VALUES (3, 'Lançador financeiro');
INSERT INTO public.role (id, name)
VALUES (4, 'Aprovador financeiro');
INSERT INTO public.role (id, name)
VALUES (5, 'Admin Finan');

-- password 123456
INSERT INTO public."user"(id, email, password, provider, "socialId", "fullName", "firstName", "lastName", hash,
                          "createdAt", "updatedAt", "deletedAt", "roleId", "statusId", "permitCode", "cpfCnpj",
                          "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", phone, "isSgtuBlocked", "passValidatorId")
VALUES
    (1, 'admin.test@prefeitura.rio', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Test User', 'Test', 'User', null, now(), now(), null, 1, null, '123456', '9363945131', 001, '0001', '12345678', '9', '5551999999999', false, null),
    (2, 'user1@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'John Doe', 'John', 'Doe', null, now(), now(), null, 1, null, '654321', '12345678900', 237, '0002', '87654321', '8', '5551888888888', false, null),
    (3, 'user2@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Jane Smith', 'Jane', 'Smith', null, now(), now(), null, 1, null, '987654', '98765432100', 104, '0003', '11223344', '7', '5551777777777', false, null),
    (4, 'user3@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Alice Brown', 'Alice', 'Brown', null, now(), now(), null, 1, null, '456789', '12312312399', 341, '0004', '55667788', '6', '5551666666666', false, null),
    (5, 'user4@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Bob White', 'Bob', 'White', null, now(), now(), null, 1, null, '789123', '98798798788', 033, '0005', '99887766', '5', '5551555555555', false, null),
    (6, 'user5@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Charlie Green', 'Charlie', 'Green', null, now(), now(), null, 1, null, '321654', '11122233344', 077, '0006', '12344321', '4', '5551444444444', false, null),
    (7, 'user6@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'David Black', 'David', 'Black', null, now(), now(), null, 1, null, '654987', '55566677788', 748, '0007', '44556677', '3', '5551333333333', false, null),
    (8, 'user7@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Emma Wilson', 'Emma', 'Wilson', null, now(), now(), null, 1, null, '789456', '99988877766', 212, '0008', '66778899', '2', '5551222222222', false, null),
    (9, 'user8@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Frank Brown', 'Frank', 'Brown', null, now(), now(), null, 1, null, '123789', '33344455599', 399, '0009', '88990011', '1', '5551111111111', false, null),
    (10, 'user9@example.com', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email', null, 'Grace Taylor', 'Grace', 'Taylor', null, now(), now(), null, 1, null, '987321', '11133355577', 001, '0010', '11122233', '0', '5551000000000', false, null);


-- atualiza o permit code dos consorcios
update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'VLT' limit 1)
where "cpfCnpj" = '18201378000119'; -- permit code = id consorcio

update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'Intersul' limit 1)
where "cpfCnpj" = '12464869000176'; -- permit code = id consorcio


update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'Internorte' limit 1)
where "cpfCnpj" = '12464539000180'; -- permit code = id consorcio

update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'Transcarioca' limit 1)
where "cpfCnpj" = '12464553000184';


update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'MobiRio' limit 1)
where "cpfCnpj" = '44520687000161';

update "user"
set "permitCode" = (select "idConsorcio" from ordem_pagamento where "nomeConsorcio" = 'Santa Cruz' limit 1)
where "cpfCnpj" = '12464577000133';