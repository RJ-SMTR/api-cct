import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Área de auditoria.
 *
 * 1) Controle do sincronismo de ordens do BigQuery: execuções, auditoria append-only de cada ordem
 *    (antes/depois/execução/motivo), quarentena para revisão e reconciliação diária.
 * 2) Auditoria do sistema: triggers que gravam todo INSERT/UPDATE/DELETE das tabelas de negócio
 *    (inclusive o que vem de procedures e SQL direto) em `auditoria_sistema`, mais o log das
 *    requisições de escrita da API. As tabelas de auditoria são append-only (UPDATE/DELETE bloqueados).
 */

/** Tabelas de negócio auditadas pelo trigger genérico (todas têm chave primária "id"). */
export const TABELAS_AUDITADAS = [
  'user',
  'ordem_pagamento',
  'ordem_pagamento_agrupado',
  'ordem_pagamento_agrupado_historico',
  'ordem_pagamento_guardador',
  'ordem_pagamento_unico',
  'detalhe_a',
  'detalhe_b',
  'header_arquivo',
  'header_lote',
  'pagamento_indevido',
  'pagador',
  'setting',
];

export class CreateAuditoria1791400000000 implements MigrationInterface {
  name = 'CreateAuditoria1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- sincronismo de ordens ----------
    await queryRunner.query(`ALTER TABLE ordem_pagamento ADD COLUMN IF NOT EXISTS "bqHash" varchar(64)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_execucao (
        id            bigserial PRIMARY KEY,
        tipo          varchar(40)  NOT NULL DEFAULT 'ordem_pagamento_bq',
        origem        varchar(10)  NOT NULL DEFAULT 'cron',
        usuario_id    integer,
        forcar        boolean      NOT NULL DEFAULT false,
        janela_inicio date,
        janela_fim    date,
        consorcios    text[],
        iniciada_em   timestamptz  NOT NULL DEFAULT now(),
        finalizada_em timestamptz,
        status        varchar(14)  NOT NULL DEFAULT 'em_andamento',
        encontradas   integer      NOT NULL DEFAULT 0,
        novas         integer      NOT NULL DEFAULT 0,
        identicas     integer      NOT NULL DEFAULT 0,
        alteradas     integer      NOT NULL DEFAULT 0,
        contidas      integer      NOT NULL DEFAULT 0,
        ignoradas     integer      NOT NULL DEFAULT 0,
        erros         integer      NOT NULL DEFAULT 0,
        observacao    text
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_execucao_iniciada ON sync_execucao (iniciada_em DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ordem_pagamento_auditoria (
        id                 bigserial PRIMARY KEY,
        execucao_id        bigint REFERENCES sync_execucao (id),
        bq_id              bigint,
        ordem_pagamento_id integer,
        acao               varchar(12) NOT NULL,
        antes              jsonb,
        depois             jsonb,
        motivo             text,
        usuario_id         integer,
        criado_em          timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_op_auditoria_bq ON ordem_pagamento_auditoria (bq_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_op_auditoria_execucao ON ordem_pagamento_auditoria (execucao_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_op_auditoria_criado ON ordem_pagamento_auditoria (criado_em DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ordem_pagamento_quarentena (
        id                  bigserial PRIMARY KEY,
        execucao_id         bigint REFERENCES sync_execucao (id),
        bq_id               bigint NOT NULL,
        ordem_pagamento_id  integer,
        hash_bq             varchar(64) NOT NULL,
        dados_bq            jsonb,
        dados_atuais        jsonb,
        campos_divergentes  text[],
        motivo              text,
        status              varchar(10) NOT NULL DEFAULT 'pendente',
        observacao_revisao  text,
        revisado_por        integer,
        revisado_em         timestamptz,
        criado_em           timestamptz NOT NULL DEFAULT now()
      )`);
    // Uma pendência por (ordem do BigQuery, versão do BigQuery): reexecutar não duplica a quarentena.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_op_quarentena_pendente
        ON ordem_pagamento_quarentena (bq_id, hash_bq) WHERE status = 'pendente'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_op_quarentena_status ON ordem_pagamento_quarentena (status, criado_em DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ordem_pagamento_reconciliacao_diaria (
        data         date PRIMARY KEY,
        bq_qtd       integer       NOT NULL DEFAULT 0,
        bq_valor     numeric(18,2) NOT NULL DEFAULT 0,
        bd_qtd       integer       NOT NULL DEFAULT 0,
        bd_valor     numeric(18,2) NOT NULL DEFAULT 0,
        dif_qtd      integer       NOT NULL DEFAULT 0,
        dif_valor    numeric(18,2) NOT NULL DEFAULT 0,
        execucao_id  bigint,
        calculado_em timestamptz   NOT NULL DEFAULT now()
      )`);

    // ---------- auditoria do sistema ----------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auditoria_sistema (
        id                bigserial PRIMARY KEY,
        tabela            text        NOT NULL,
        operacao          char(1)     NOT NULL,
        registro_id       text,
        antes             jsonb,
        depois            jsonb,
        colunas_alteradas text[],
        usuario_app_id    integer,
        usuario_db        text        NOT NULL DEFAULT current_user,
        aplicacao         text,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_sistema_tabela ON auditoria_sistema (tabela, criado_em DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_sistema_registro ON auditoria_sistema (tabela, registro_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_sistema_criado ON auditoria_sistema (criado_em DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auditoria_requisicao (
        id          bigserial PRIMARY KEY,
        usuario_id  integer,
        metodo      varchar(8)  NOT NULL,
        rota        text        NOT NULL,
        status_http integer,
        corpo       jsonb,
        ip          text,
        duracao_ms  integer,
        criado_em   timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_requisicao_criado ON auditoria_requisicao (criado_em DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_requisicao_usuario ON auditoria_requisicao (usuario_id, criado_em DESC)`);

    // ---------- append-only ----------
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_auditoria_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'A tabela % é de auditoria (append-only): % não é permitido.', TG_TABLE_NAME, TG_OP;
      END;
      $$ LANGUAGE plpgsql`);
    for (const tabela of ['ordem_pagamento_auditoria', 'auditoria_sistema', 'auditoria_requisicao']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${tabela}_append_only ON ${tabela}`);
      await queryRunner.query(`
        CREATE TRIGGER trg_${tabela}_append_only BEFORE UPDATE OR DELETE ON ${tabela}
        FOR EACH ROW EXECUTE FUNCTION fn_auditoria_append_only()`);
    }

    // ---------- trigger genérico do sistema ----------
    // INSERT: grava a linha nova; DELETE: a linha antiga; UPDATE: só as colunas que mudaram (antes/depois),
    // ignorando "updatedAt" e atualizações sem mudança real. Segredos (senha/hash) nunca entram no log.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_auditoria_sistema() RETURNS trigger AS $$
      DECLARE
        v_sensiveis text[] := ARRAY['password', 'hash', 'previousPassword'];
        v_antes     jsonb;
        v_depois    jsonb;
        v_cols      text[];
        v_id        text;
        v_usuario   integer;
      BEGIN
        BEGIN
          v_usuario := NULLIF(current_setting('app.usuario_id', true), '')::integer;
        EXCEPTION WHEN others THEN
          v_usuario := NULL;
        END;

        IF TG_OP = 'INSERT' THEN
          v_depois := to_jsonb(NEW) - v_sensiveis;
          v_id := to_jsonb(NEW) ->> 'id';
        ELSIF TG_OP = 'DELETE' THEN
          v_antes := to_jsonb(OLD) - v_sensiveis;
          v_id := to_jsonb(OLD) ->> 'id';
        ELSE
          v_id := to_jsonb(NEW) ->> 'id';
          SELECT array_agg(n.key ORDER BY n.key) INTO v_cols
            FROM jsonb_each(to_jsonb(NEW) - v_sensiveis) n
            LEFT JOIN jsonb_each(to_jsonb(OLD) - v_sensiveis) o ON o.key = n.key
           WHERE n.key <> 'updatedAt' AND n.value IS DISTINCT FROM o.value;
          IF v_cols IS NULL THEN
            RETURN NEW;
          END IF;
          SELECT jsonb_object_agg(c, (to_jsonb(OLD) - v_sensiveis) -> c),
                 jsonb_object_agg(c, (to_jsonb(NEW) - v_sensiveis) -> c)
            INTO v_antes, v_depois
            FROM unnest(v_cols) c;
        END IF;

        INSERT INTO auditoria_sistema (tabela, operacao, registro_id, antes, depois, colunas_alteradas, usuario_app_id, aplicacao)
        VALUES (TG_TABLE_NAME, left(TG_OP, 1), v_id, v_antes, v_depois, v_cols, v_usuario, current_setting('application_name', true));

        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql`);

    for (const tabela of TABELAS_AUDITADAS) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_auditoria_sistema ON public."${tabela}"`);
      await queryRunner.query(`
        CREATE TRIGGER trg_auditoria_sistema AFTER INSERT OR UPDATE OR DELETE ON public."${tabela}"
        FOR EACH ROW EXECUTE FUNCTION fn_auditoria_sistema()`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabela of TABELAS_AUDITADAS) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_auditoria_sistema ON public."${tabela}"`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS fn_auditoria_sistema()`);
    for (const tabela of ['ordem_pagamento_auditoria', 'auditoria_sistema', 'auditoria_requisicao']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${tabela}_append_only ON ${tabela}`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS fn_auditoria_append_only()`);
    await queryRunner.query(`DROP TABLE IF EXISTS auditoria_requisicao`);
    await queryRunner.query(`DROP TABLE IF EXISTS auditoria_sistema`);
    await queryRunner.query(`DROP TABLE IF EXISTS ordem_pagamento_reconciliacao_diaria`);
    await queryRunner.query(`DROP TABLE IF EXISTS ordem_pagamento_quarentena`);
    await queryRunner.query(`DROP TABLE IF EXISTS ordem_pagamento_auditoria`);
    await queryRunner.query(`DROP TABLE IF EXISTS sync_execucao`);
    await queryRunner.query(`ALTER TABLE ordem_pagamento DROP COLUMN IF EXISTS "bqHash"`);
  }
}
