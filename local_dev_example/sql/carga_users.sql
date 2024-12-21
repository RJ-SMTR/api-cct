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
                          "createdAt", "updatedAt",
                          "deletedAt", "roleId", "statusId", "permitCode", "cpfCnpj", "bankCode", "bankAgency",
                          "bankAccount", "bankAccountDigit", phone, "isSgtuBlocked", "passValidatorId")
VALUES (1, 'admin.test@prefeitura.rio', '$2b$12$Fj8WzjBY1fEiPjV42SbtpOKNtr9vgKXQpfpW784Vo7Znh7qVIIpRy', 'email',
        null, 'Test User', 'Test', 'User', null, now(), now(), null, 1, null, '123456', '9363945131', null, null, null,
        null, null, null, null);