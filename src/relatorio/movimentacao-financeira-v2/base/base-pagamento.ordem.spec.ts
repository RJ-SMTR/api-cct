import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { chaveOrdemAlfabeticaSql } from '../../utils/ordem-alfabetica-sql';
import { BasePagamentoRepository } from './base-pagamento.repository';

// Nome como o Consolidado ordena (pt-BR, espaco contando) - ver ordem-alfabetica-sql.ts.
const CHAVE_NOME = chaveOrdemAlfabeticaSql('nomes');

// Relatorios sempre em ordem alfabetica do nome, qualquer que seja o filtro, para Permissionario e
// Guardador, na tela e no arquivo exportado (os dois leem findGroupedRowsPage). Sem banco aqui: o
// teste olha a consulta gerada - a primeira chave do ORDER BY e' o nome, e o keyset compara cada
// coluna com o parametro do cursor da mesma coluna (senao a pagina seguinte pula ou repete linhas).
describe('BasePagamentoRepository - ordem alfabetica', () => {
  const periodo = { dataInicio: new Date('2026-10-01T00:00:00Z'), dataFim: new Date('2026-10-31T00:00:00Z') };

  function repositorioCapturandoConsulta() {
    const repository = new BasePagamentoRepository({} as DataSource);
    const consultas: Array<{ sql: string; params: unknown[] }> = [];
    jest.spyOn(repository, 'runReportQuery').mockImplementation((sql: string, params: unknown[]) => {
      consultas.push({ sql, params });
      return Promise.resolve([]);
    });
    return { repository, consultas };
  }

  const primeiraChaveDoOrderBy = (sql: string) => {
    const orderBy = sql.slice(sql.lastIndexOf('ORDER BY') + 'ORDER BY'.length).trim();
    // Uma chave por linha (CURSOR_TUPLE); split por virgula quebraria dentro de COALESCE(nomes, '').
    const [primeiraLinha] = orderBy.split('\n').map((linha) => linha.trim()).filter(Boolean);
    return primeiraLinha.replace(/,$/, '');
  };

  it.each(['permissionario', 'guardador'] as const)('pagina/export de %s ordena primeiro pelo nome', async (perfil) => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findGroupedRowsPage(perfil, { ...periodo, statuses: [StatusPagamento.PAGO] }, 50);

    expect(primeiraChaveDoOrderBy(consultas[0].sql)).toBe(CHAVE_NOME);
  });

  it('no mesmo nome, a data e a segunda chave', async () => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findGroupedRowsPage('permissionario', periodo, 50);

    const { sql } = consultas[0];
    const chaves = sql
      .slice(sql.lastIndexOf('ORDER BY') + 'ORDER BY'.length)
      .split('\n')
      .map((linha) => linha.trim().replace(/,$/, ''))
      .filter(Boolean);
    expect(chaves.slice(0, 2)).toEqual([CHAVE_NOME, '"dataReferencia"']);
  });

  it('findGroupedRows (resumos e agregacoes) segue a mesma ordem', async () => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findGroupedRows('permissionario', periodo);

    expect(primeiraChaveDoOrderBy(consultas[0].sql)).toBe(CHAVE_NOME);
  });

  it('o keyset compara o nome com o nome do cursor, na mesma posicao da ordenacao', async () => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findGroupedRowsPage('guardador', periodo, 50, {
      dataReferencia: '2026-10-05',
      nomes: 'MARIA DO CURSOR',
      cpfCnpj: '11122233344',
      nomeConsorcio: null,
      status: StatusPagamento.PAGO,
      valor: '10.00',
    });

    const { sql, params } = consultas[0];
    const posicaoNome = params.indexOf('MARIA DO CURSOR') + 1;
    const posicaoData = params.indexOf('2026-10-05') + 1;
    const tuplaDoCursor = sql.slice(sql.indexOf('> (', sql.indexOf('OR (')) + 3).trim();
    const ordemNaTupla = (marcador: string) => tuplaDoCursor.indexOf(marcador);

    // O nome do cursor passa pela mesma chave da ordenacao, e vem antes da data.
    expect(tuplaDoCursor.startsWith(chaveOrdemAlfabeticaSql(`$${posicaoNome}::text`))).toBe(true);
    expect(ordemNaTupla(`$${posicaoNome}::text`)).toBeLessThan(ordemNaTupla(`$${posicaoData}::date`));
  });

  // Mensagem de erro do banco na tela e no export: o codigo de ocorrencia sai da consulta em toda
  // fonte que pode ser Estorno/Rejeitado, e o lote somado junta os codigos em vez de perde-los.
  it.each([false, true])('a pagina (dia unico = %s) devolve o codigo de erro do banco das fontes de Estorno/Rejeitado', async (diaUnico) => {
    const { repository, consultas } = repositorioCapturandoConsulta();
    const dataFim = diaUnico ? periodo.dataInicio : periodo.dataFim;

    await repository.findGroupedRowsPage('permissionario', { dataInicio: periodo.dataInicio, dataFim }, 50);

    const { sql } = consultas[0];
    expect(sql).toMatch(/SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status, "chaveLinha", "codigoErro", motivo\s+FROM filtrado/);
    expect(sql).toMatch(/string_agg\(DISTINCT "codigoErro"/);
    const fonteDeErro = (prefixo: string) => {
      const inicio = sql.indexOf(`'${prefixo}:'`);
      return sql.slice(inicio, inicio + 600);
    };
    const prefixos = diaUnico ? ['pendencia_pagamento_familia', 'pendencia_pagamento_propria'] : ['pendencia_pagamento_intervalo'];
    for (const prefixo of prefixos) {
      expect(fonteDeErro(prefixo)).toMatch(/NULLIF\(TRIM\(oph(_pai)?\."motivoStatusRemessa"\), ''\)\s+END AS "codigoErro"/);
    }
    const agrupada = sql.slice(sql.indexOf('agrupada AS ('), sql.indexOf('pendencia_paga AS ('));
    expect(agrupada).toMatch(/NULLIF\(TRIM\(oph\."motivoStatusRemessa"\), ''\)\s+END AS "codigoErro"/);
  });

  it('Eleicao devolve o codigo de erro do banco', async () => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findEleicaoRows(periodo);

    expect(consultas[0].sql).toMatch(/NULLIF\(TRIM\(oph\."motivoStatusRemessa"\), ''\)\s+END AS "codigoErro"/);
    expect(consultas[0].sql).toMatch(/SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status, "codigoErro"\s+FROM filtrado/);
  });

  it('Eleicao tambem ordena primeiro pelo nome', async () => {
    const { repository, consultas } = repositorioCapturandoConsulta();

    await repository.findEleicaoRows(periodo);

    expect(consultas[0].sql).toContain(`ORDER BY ${CHAVE_NOME}, "dataReferencia"`);
  });
});
