import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import * as xlsx from 'xlsx';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoListFilters, OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { User } from 'src/users/entities/user.entity';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { OrdemPagamentoMensalDto } from '../dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { replaceUndefinedWithNull } from '../../../utils/type-utils';
import { endOfDay, isValid, startOfDay } from 'date-fns';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { BigqueryOrdemPagamentoGuardadorDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento-guardador.dto';
import { OrdemPagamentoGuardadorListFilters, OrdemPagamentoGuardadorRepository } from '../repository/ordem-pagamento-guardador.repository';
import { OrdemPagamentoGuardador } from '../entity/ordem-pagamento-guardador.entity';

/** Mesma lista sincronizada pelo cron (CronJobsService.CONSORCIOS + MODAIS). */
export const CONSORCIOS_E_MODAIS_SINCRONIZADOS = [
  'VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'GTU',
  'STPC', 'STPL', 'TEC',
];

/** Limite de dias do sincronismo manual, para uma chamada não varrer o BigQuery inteiro. */
export const MAX_DIAS_SINCRONISMO_MANUAL = 31;

export interface ResultadoSincronismoOrdens {
  dataInicio: string;
  dataFim: string;
  encontradasNoBigQuery: number;
  inseridas: number;
  /** A contagem local era igual à do BigQuery (a comparação por hash roda mesmo assim). */
  puladoPorContagemIgual: boolean;
  /** Execução registrada em sync_execucao (auditoria). */
  execucaoId?: number;
  identicas?: number;
  alteradas?: number;
  contidas?: number;
  ignoradas?: number;
  erros?: number;
}

export interface ContextoSincronismoOrdens {
  origem?: 'cron' | 'manual';
  usuarioId?: number | null;
}

@Injectable()
export class OrdemPagamentoService {
 

  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(private ordemPagamentoRepository: OrdemPagamentoRepository,
    private ordemPagamentoGuardadorRepository: OrdemPagamentoGuardadorRepository,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService, private usersService: UsersService) { }

  async findPermissionarioListPaginated(
    page: number,
    limit: number,
    filters?: OrdemPagamentoListFilters,
  ): Promise<{ data: any[]; count: number; valorTotal: number }> {
    const [[data, count], valorTotal] = await Promise.all([
      this.ordemPagamentoRepository.findAllPaginated(page, limit, filters),
      this.ordemPagamentoRepository.sumValorFiltered(filters),
    ]);

    return {
      data: data.map((ordem) => ({
        id: ordem.id,
        dataOrdem: ordem.dataOrdem,
        nomeConsorcio: ordem.nomeConsorcio,
        nomeOperadora: ordem.nomeOperadora,
        valor: Number(ordem.valor),
      })),
      count,
      valorTotal,
    };
  }

  async findGuardadorListPaginated(
    page: number,
    limit: number,
    filters?: OrdemPagamentoGuardadorListFilters,
  ): Promise<{ data: any[]; count: number; valorTotal: number }> {
    const [[data, count], valorTotal] = await Promise.all([
      this.ordemPagamentoGuardadorRepository.findAllPaginated(page, limit, filters),
      this.ordemPagamentoGuardadorRepository.sumValorFiltered(filters),
    ]);

    return {
      data: data.map((ordem) => ({
        id: ordem.id,
        dataOrdem: ordem.dataOrdem,
        cpfCnpj: ordem.user?.cpfCnpj ?? null,
        fullName: ordem.user?.fullName ?? null,
        valor: Number(ordem.valorRepasseGuardador),
      })),
      count,
      valorTotal,
    };
  }

  /**
   * Extrai a coluna de documento (CPF/CNPJ) e a coluna de valor de uma linha
   * de planilha lida em modo objeto (chaves = cabeçalhos). As planilhas de
   * guardadores usadas no CCT não têm nomes de coluna padronizados entre
   * abas, então a busca é por nome aproximado, com fallback posicional
   * (primeira coluna = documento, última coluna = valor).
   */
  private extractDocumentoAndValorFromRow(row: Record<string, any>): { documentoRaw: any; valorRaw: any } {
    const keys = Object.keys(row);
    const documentoKey = keys.find((key) => /cpf|cnpj/i.test(key));
    const valorKey = keys.find((key) => /valor/i.test(key));

    // Sem coluna "Valor" no cabeçalho: usa a última coluna PREENCHIDA da linha (colunas em branco à direita são ignoradas).
    const ultimaPreenchida = [...keys].reverse().find((key) => key !== keys[0] && String(row[key] ?? '').trim() !== '');
    return {
      documentoRaw: documentoKey !== undefined ? row[documentoKey] : row[keys[0]],
      valorRaw: valorKey !== undefined ? row[valorKey] : row[ultimaPreenchida ?? keys[keys.length - 1]],
    };
  }

  /** A linha já é um dado (CPF/CNPJ + valor), e não um cabeçalho com nomes de coluna. */
  private looksLikeDataRow(row: any[] | undefined): boolean {
    if (!row || row.length < 2) return false;
    const documentoDigits = String(row[0] ?? '').replace(/\D/g, '');
    const valorCell = String(row[row.length - 1] ?? '');
    return (
      (documentoDigits.length === 11 || documentoDigits.length === 14) &&
      /\d/.test(valorCell) &&
      Number.isFinite(this.parseCurrencyValue(valorCell))
    );
  }

  /**
   * Lê as linhas de uma aba. Com cabeçalho (ex.: "CPF", "Valor"), a primeira linha dá os nomes das colunas.
   * Sem cabeçalho (a primeira linha já é um CPF/CNPJ com valor), nenhuma linha pode ser descartada:
   * o modo objeto do xlsx usa a primeira linha como nomes de coluna e perderia o primeiro pagamento.
   * `firstDataRowNumber` é o número da linha da planilha (base 1) da primeira linha de dados.
   */
  private readSheetRows(worksheet: xlsx.WorkSheet): { rows: Record<string, any>[]; firstDataRowNumber: number } {
    // Colunas vazias à direita (formatação/células em branco que estendem o intervalo da aba) não contam: sem isso a
    // "última coluna" seria vazia e o valor de todas as linhas viraria inválido.
    const matrix = xlsx.utils
      .sheet_to_json<any[]>(worksheet, { header: 1, defval: '', raw: false })
      .map((row) => this.trimTrailingEmptyCells(row));
    const firstRowIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

    if (firstRowIndex >= 0 && this.looksLikeDataRow(matrix[firstRowIndex])) {
      return {
        rows: matrix.slice(firstRowIndex).map((row) => Object.fromEntries(row.map((cell, index) => [`col_${index}`, cell]))),
        firstDataRowNumber: firstRowIndex + 1,
      };
    }

    return {
      rows: xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false }),
      firstDataRowNumber: 2, // +1 pelo cabeçalho, +1 para base 1
    };
  }

  private trimTrailingEmptyCells(row: any[]): any[] {
    let end = row.length;
    while (end > 0 && String(row[end - 1] ?? '').trim() === '') end--;
    return row.slice(0, end);
  }

  /** Remove tudo que não é dígito e completa com zeros à esquerda até 11 dígitos (CPF). */
  private normalizeDocumento(raw: any): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length < 11 ? digits.padStart(11, '0') : digits;
  }

  /** Converte "R$ 57.40" (decimal com ponto) ou "R$ 4.169,22" (BR, decimal com vírgula) em número. */
  private parseCurrencyValue(raw: any): number {
    let normalized = String(raw ?? '').replace(/[^0-9.,-]/g, '').trim();
    if (!normalized) return NaN;

    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      normalized = normalized.replace(/,/g, '');
    }

    return parseFloat(normalized);
  }

  /**
   * Extrai a data da ordem a partir do nome do arquivo (ex.: "Pagamento 22_09.xlsx"
   * -> 22/09 do ano corrente; "Pagamento 22_09_2025.xlsx" -> 22/09/2025).
   * Retorna null se não encontrar um padrão de data reconhecível.
   */
  private extractDateFromFilename(filename?: string): Date | null {
    if (!filename) return null;

    const match = filename.match(/(\d{1,2})[_\-.](\d{1,2})(?:[_\-.](\d{2,4}))?/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : new Date().getFullYear();

    if (year < 100) {
      year += 2000;
    }

    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return null;
    }

    const date = startOfDay(new Date(year, month - 1, day));
    return isValid(date) ? date : null;
  }

  async importGuardadorSpreadsheet(file: Express.Multer.File): Promise<{
    totalRows: number;
    imported: number;
    skipped: number;
    dataOrdemUtilizada: Date;
    errors: { sheet: string; row: number; documento: string; motivo: string }[];
  }> {
    if (!file) {
      throw new HttpException({ error: 'Selecione um arquivo para importar.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(file.buffer, { type: 'buffer', codepage: 65001 });
    } catch (e) {
      throw new HttpException({ error: 'Não foi possível ler a planilha enviada.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    // A data da ordem vem do nome do arquivo (ex.: "Pagamento 22_09.xlsx" = 22/09),
    // não da data de hoje — cai para hoje só se o nome não tiver um padrão de data.
    const today = this.extractDateFromFilename(file.originalname) ?? startOfDay(new Date());
    const errors: { sheet: string; row: number; documento: string; motivo: string }[] = [];
    const entitiesToInsert: DeepPartial<OrdemPagamentoGuardador>[] = [];
    let totalRows = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const { rows, firstDataRowNumber } = this.readSheetRows(worksheet);

      for (let i = 0; i < rows.length; i++) {
        const { documentoRaw, valorRaw } = this.extractDocumentoAndValorFromRow(rows[i]);
        const documento = this.normalizeDocumento(documentoRaw);
        const rowNumber = firstDataRowNumber + i;

        if (!documento) {
          continue;
        }

        totalRows++;

        const valor = this.parseCurrencyValue(valorRaw);
        if (!Number.isFinite(valor)) {
          errors.push({ sheet: sheetName, row: rowNumber, documento, motivo: 'Valor inválido' });
          continue;
        }

        const user = await this.usersService.findOne({ cpfCnpj: documento });
        if (!user) {
          errors.push({ sheet: sheetName, row: rowNumber, documento, motivo: 'Usuário não encontrado para este CPF/CNPJ' });
          continue;
        }

        entitiesToInsert.push({
          dataOrdem: today,
          qtdVerificacaoTotal: 1,
          qtdVerificacaoValida: 1,
          qtdVerificacaoInvalida: 1,
          valorRepasseGuardador: valor,
          dataInclusao: today,
          user: { id: user.id } as User,
          tipoOrdemPagamento: 'Manual',
          idOrdemPagamento: documento,
        });
      }
    }

    if (entitiesToInsert.length > 0) {
      await this.ordemPagamentoGuardadorRepository.saveMany(entitiesToInsert);
    }

    return {
      totalRows,
      imported: entitiesToInsert.length,
      skipped: errors.length,
      dataOrdemUtilizada: today,
      errors: errors.slice(0, 100),
    };
  }

  /** Ids locais de ordem_pagamento -> ids do BigQuery, para consultar transações. */
  async converterParaBqIds(ids: (number | undefined)[]): Promise<number[]> {
    return this.ordemPagamentoRepository.findBqIdsByIds(ids.filter((id): id is number => id != null).map(Number));
  }

  /**
   * Busca no BigQuery as ordens capturadas entre as datas (pela data de captura) e compara cada uma com o
   * banco pela chave `bqId` + hash dos campos (ver auditoria/ordem-sync-auditoria.ts):
   *  nova -> insere | idêntica -> descarta | mudou e ainda livre -> atualiza | mudou e contida -> quarentena.
   * Toda execução é registrada (janela e contagens), cada gravação gera auditoria append-only e, no fim, a
   * contagem/soma por dia é reconciliada com o BigQuery. É idempotente: reexecutar não duplica.
   *
   * @param forcar mantido por compatibilidade: a comparação por hash roda sempre, mesmo quando a contagem
   *               local bate com a do BigQuery (antes, a contagem igual pulava e escondia ordens alteradas).
   */
  async sincronizarOrdensPagamento(
    dataCapturaInicialDate: Date,
    dataCapturaFinalDate: Date,
    consorcio: string[],
    forcar = false,
    contexto: ContextoSincronismoOrdens = {},
  ): Promise<ResultadoSincronismoOrdens> {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: consorcio });
    const numOrdensSemana = await this.findNumeroDeOrdensPorIntervalo(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));

    const dataInicio = dataCapturaInicialDate.toISOString().slice(0, 10);
    const dataFim = dataCapturaFinalDate.toISOString().slice(0, 10);
    const sync = this.ordemPagamentoRepository.sync;
    const execucaoId = await sync.iniciarExecucao({
      origem: contexto.origem ?? 'cron',
      usuarioId: contexto.usuarioId,
      forcar,
      janelaInicio: dataInicio,
      janelaFim: dataFim,
      consorcios: consorcio,
    });
    const contagens = { encontradas: ordens.length, novas: 0, identicas: 0, alteradas: 0, contidas: 0, ignoradas: 0, erros: 0 };

    try {
      this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens (execução ${execucaoId})`, METHOD);
      const existentes = await sync.buscarPorBqIds(ordens.map((o) => Number(o.id)));

      for (const ordem of ordens) {
        if (!ordem.operadoraCpfCnpj) {
          contagens.ignoradas += 1;
          continue;
        }
        try {
          const existente = existentes.get(Number(ordem.id));
          let userId: number | undefined = existente?.userId ?? undefined;
          if (!existente) {
            const dono = await this.resolverUsuarioDaOrdem(ordem);
            if (dono === null) {
              // usuário bloqueado: a ordem não é gravada (regra anterior do sincronismo)
              contagens.ignoradas += 1;
              continue;
            }
            userId = dono;
          }
          const resultado = await sync.aplicar(BigQueryToOrdemPagamento.convert(ordem, userId), existente, execucaoId);
          if (resultado === 'nova') contagens.novas += 1;
          else if (resultado === 'identica') contagens.identicas += 1;
          else if (resultado === 'alterada') contagens.alteradas += 1;
          else if (resultado === 'contida') contagens.contidas += 1;
          else {
            contagens.alteradas += 1;
            contagens.contidas += 1;
          }
        } catch (error) {
          contagens.erros += 1;
          this.logger.error(`Erro ao sincronizar ordem de pagamento ${ordem.id}: ${error.message}`, METHOD);
        }
      }

      await this.reconciliarPorDia(ordens, dataInicio, dataFim, consorcio, execucaoId);
      await sync.finalizarExecucao(execucaoId, 'concluida', contagens);
    } catch (error) {
      await sync.finalizarExecucao(execucaoId, 'erro', contagens, error?.message);
      throw error;
    }

    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
    return {
      dataInicio,
      dataFim,
      encontradasNoBigQuery: ordens.length,
      inseridas: contagens.novas,
      puladoPorContagemIgual: !forcar && numOrdensSemana === ordens.length,
      execucaoId,
      identicas: contagens.identicas,
      alteradas: contagens.alteradas,
      contidas: contagens.contidas,
      ignoradas: contagens.ignoradas,
      erros: contagens.erros,
    };
  }

  /**
   * Usuário dono da ordem nova. Modais: pelo CPF/CNPJ; demais: pelo idConsorcio === permitCode.
   * Devolve `undefined` quando o usuário não existe (a ordem entra sem usuário) e `null` quando está bloqueado.
   */
  private async resolverUsuarioDaOrdem(ordem: BigqueryOrdemPagamentoDTO): Promise<number | undefined | null> {
    let user: User | undefined;
    try {
      if (ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL' || ordem.consorcio === 'TEC') {
        user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj as string });
      } else {
        user = await this.usersService.getOne({ permitCode: ordem.idConsorcio });
      }
    } catch (error) {
      if (error instanceof HttpException) return undefined;
      throw error;
    }
    if (user?.bloqueado) return null;
    return user?.id;
  }

  /** Contagem e soma por dia de captura: BigQuery x banco, gravadas para a tela de reconciliação diária. */
  private async reconciliarPorDia(ordens: BigqueryOrdemPagamentoDTO[], dataInicio: string, dataFim: string, consorcio: string[], execucaoId: number) {
    const bq = new Map<string, { qtd: number; valor: number }>();
    ordens
      .filter((o) => o.operadoraCpfCnpj && o.dataCaptura)
      .forEach((o) => {
        const dia = new Date(o.dataCaptura).toISOString().slice(0, 10);
        const atual = bq.get(dia) ?? { qtd: 0, valor: 0 };
        atual.qtd += 1;
        atual.valor += Number(o.valorTotalTransacaoLiquido) || 0;
        bq.set(dia, atual);
      });
    const banco = await this.ordemPagamentoRepository.sync.contagemDiariaBanco(dataInicio, dataFim, consorcio);
    const dias = [...new Set([...bq.keys(), ...banco.keys()])].sort();
    await this.ordemPagamentoRepository.sync.salvarReconciliacao(
      dias.map((data) => ({
        data,
        bqQtd: bq.get(data)?.qtd ?? 0,
        bqValor: Math.round((bq.get(data)?.valor ?? 0) * 100) / 100,
        bdQtd: banco.get(data)?.qtd ?? 0,
        bdValor: Math.round((banco.get(data)?.valor ?? 0) * 100) / 100,
      })),
      execucaoId,
    );
  }

  /**
   * Sincronismo manual de um intervalo de datas de captura, para recuperar ordens que o cron não
   * trouxe (janela errada, ordem gerada depois). Sempre força a busca e aceita no máximo
   * MAX_DIAS_SINCRONISMO_MANUAL dias. Não agrupa nada: o agrupamento continua sendo o fluxo normal.
   */
  async sincronizarOrdensPorPeriodo(dataInicio: Date, dataFim: Date, consorcio?: string[], usuarioId?: number): Promise<ResultadoSincronismoOrdens> {
    if (!isValid(dataInicio) || !isValid(dataFim)) {
      throw new HttpException({ error: 'Datas inválidas.' }, HttpStatus.BAD_REQUEST);
    }
    if (dataInicio > dataFim) {
      throw new HttpException({ error: 'dataInicio deve ser menor ou igual a dataFim.' }, HttpStatus.BAD_REQUEST);
    }
    const dias = Math.round((dataFim.getTime() - dataInicio.getTime()) / 86_400_000) + 1;
    if (dias > MAX_DIAS_SINCRONISMO_MANUAL) {
      throw new HttpException({ error: `O período máximo é de ${MAX_DIAS_SINCRONISMO_MANUAL} dias (pedido: ${dias}).` }, HttpStatus.BAD_REQUEST);
    }
    return this.sincronizarOrdensPagamento(dataInicio, dataFim, consorcio?.length ? consorcio : CONSORCIOS_E_MODAIS_SINCRONIZADOS, true, { origem: 'manual', usuarioId });
  }

  async sincronizarOrdensPagamentoGuardador(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date) {
    const METHOD = 'sincronizarOrdensPagamentoGuardador';
    //const ordens = await this.bigqueryOrdemPagamentoService.getFromWeekOrdemGuardador(dataCapturaInicialDate, dataCapturaFinalDate, 0);

    // const numOrdensSemana = await this.findNumeroDeOrdensPorIntervaloGuardador(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    // // Verifica se a ultima data de captura é igual a data atual
    // // E se o número de ordens é diferente.
    // if (numOrdensSemana === ordens.length) {
    //   this.logger.log(`Já foi feita a captura de ordens de pagamento para o dia de hoje.`, METHOD);
    //   return;
    // }

    const ordens = await this.ordemPagamentoGuardadorRepository.findOrdensPorPeriodo(dataCapturaInicialDate, dataCapturaFinalDate);

    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      let user: User | undefined;
      if (ordem.idOrdemPagamento) {
        try {
          user = await this.usersService.getOne({ cpfCnpj: ordem.idOrdemPagamento });          
          if (user && !user.bloqueado) {
            this.logger.debug(`Salvando para usuario: ${user.fullName}`, METHOD);
           // await this.saveOrdemGuardador(ordem,user.id);
            ordem.user = user;
            await this.ordemPagamentoGuardadorRepository.save(ordem);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
           ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
           // await this.saveOrdemGuardador(ordem,undefined);
          } else {
            this.logger.error(`Erro ao sincronizar ordem de pagamento guardador ${ordem.dataOrdem}: ${error.message}`, METHOD);
          }
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
  }

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPagamentoRepository.save(ordemPagamento);
  }

   async saveOrdemGuardador(ordem: BigqueryOrdemPagamentoGuardadorDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convertOrdemGuardador(ordem, userId);
    await this.ordemPagamentoGuardadorRepository.save(ordemPagamento);
  }

  async findOrdensPagamentoAgrupadasPorMes(userId: number, yearMonth: Date): Promise<OrdemPagamentoMensalDto> {
    const ordensDoMes = await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasPorMes(userId, yearMonth);
    const ordemPagamentoMensal = new OrdemPagamentoMensalDto();
    ordemPagamentoMensal.ordens = ordensDoMes.map((ordem) => {
      const o = new OrdemPagamentoAgrupadoMensalDto();
      o.ordemPagamentoAgrupadoIds = ordem.ordemPagamentoAgrupadoIds;
      o.ordemPagamentoAgrupadoId = ordem.ordemPagamentoAgrupadoId;
      o.motivoStatusRemessa = ordem.motivoStatusRemessa;
      o.valorTotal = ordem.valorTotal;
      o.statusRemessa = ordem.statusRemessa;
      o.descricaoMotivoStatusRemessa = ordem.descricaoMotivoStatusRemessa;
      o.descricaoStatusRemessa = ordem.descricaoStatusRemessa;
      o.data = ordem.data;
      o.dataPagamento = ordem.dataPagamento;
      o.valorGratuidade = ordem.valorGratuidade;
      o.statusRemessaGratuidade = ordem.statusRemessaGratuidade;
      o.motivoStatusRemessaGratuidade = ordem.motivoStatusRemessaGratuidade;
      o.descricaoStatusRemessaGratuidade = ordem.descricaoStatusRemessaGratuidade;
      o.descricaoMotivoStatusRemessaGratuidade = ordem.descricaoMotivoStatusRemessaGratuidade;
      replaceUndefinedWithNull(o);
      return o;
    });
    ordemPagamentoMensal.valorTotal = ordensDoMes.reduce((acc, ordem) => acc + (ordem.valorTotal || 0), 0);
    ordemPagamentoMensal.valorTotalPago = ordensDoMes.reduce((acc, ordem) => {
      if (ordem.motivoStatusRemessa &&
        (ordem.motivoStatusRemessa.toString() === '00' || ordem.motivoStatusRemessa.toString() === 'BD')) {
        return acc + (ordem.valorTotal || 0);
      }
      return acc;
    }, 0);
    return ordemPagamentoMensal;
  }

  async findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds: string, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds, userId);
  }

  async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds: string, userId: number, endDateParam?: Date): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds, userId, endDateParam);
  }

  async findOrdensPagamentosPendentesQueNuncaForamRemetidas(userId?: number | undefined): Promise<OrdemPagamentoPendenteNuncaRemetidasDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentesQueNuncaForamRemetidas(userId);
  }

  async findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userId);
  }

  async findNumeroDeOrdensPorIntervalo(startDate: Date, endDate: Date) {
    return await this.ordemPagamentoRepository.findNumeroOrdensPorIntervaloDataCaptura(startDate, endDate);
  }

  async findNumeroDeOrdensPorIntervaloGuardador(startDate: Date, endDate: Date) {
    return await this.ordemPagamentoGuardadorRepository.findNumeroOrdensPorIntervaloDataCaptura(startDate, endDate);
  }

  async findOrdensAgrupadas(dataInicio: Date, dataFim: Date, consorcios: string[]): Promise<OrdemPagamento[]> {
    return this.ordemPagamentoRepository.findOrdensAgrupadas(dataInicio, dataFim, consorcios);
  }

  async findOrdensAgrupadasGuardador(dataInicio: Date, dataFim: Date): Promise<OrdemPagamentoGuardador[]> {
   return this.ordemPagamentoGuardadorRepository.findOrdensAgrupadas(dataInicio, dataFim);
  }

  async removerAgrupamentos(consorcios: string[], ids: string) {
    await this.ordemPagamentoRepository.removerAgrupamento(consorcios, ids)
  }

   async removerAgrupamentosGuardador(ids: string) {
    await this.ordemPagamentoGuardadorRepository.removerAgrupamento(ids)
  }

  public async getOrdensPendentes(dataInicio: Date, dataFim: Date, nomes: string[]) {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentes(dataInicio, dataFim, nomes)
  }

}
