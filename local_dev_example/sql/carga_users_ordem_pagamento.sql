-- Distribui ordens de pagamentos entre os usuários com ID 1 a 10 para fins de teste.
DO $$
    DECLARE
        ordens RECORD;
        user_id INTEGER;
    BEGIN
        -- Loop para percorrer cada ordem de pagamento com userId nulo
        FOR ordens IN (
            SELECT id
            FROM public.ordem_pagamento
            WHERE "userId" IS NULL
        )
            LOOP
                -- Gerar um userId aleatório entre 1 e 10
                user_id := (FLOOR(random() * 10) + 1)::INTEGER;

                -- Atualizar o registro com o userId gerado
                UPDATE public.ordem_pagamento
                SET "userId" = user_id
                WHERE id = ordens.id;
            END LOOP;
    END $$;
