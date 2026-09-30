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

    return {
      documentoRaw: documentoKey !== undefined ? row[documentoKey] : row[keys[0]],
      valorRaw: valorKey !== undefined ? row[valorKey] : row[keys[keys.length - 1]],
    };
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
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

      for (let i = 0; i < rows.length; i++) {
        const { documentoRaw, valorRaw } = this.extractDocumentoAndValorFromRow(rows[i]);
        const documento = this.normalizeDocumento(documentoRaw);
        const rowNumber = i + 2; // +1 pelo cabeçalho, +1 para base 1

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

  async sincronizarOrdensPagamento(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date, consorcio: string[]) {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: consorcio });

    const numOrdensSemana = await this.findNumeroDeOrdensPorIntervalo(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    // Verifica se a ultima data de captura é igual a data atual
    // E se o número de ordens é diferente.
    if (numOrdensSemana === ordens.length) {
      this.logger.log(`Já foi feita a captura de ordens de pagamento para o dia de hoje.`, METHOD);
      return;
    }

    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      let user: User | undefined;
      if (ordem.operadoraCpfCnpj) {
        try {
          /*
              Caso sejam modais, obtemos o usuário pelo CPF/CNPJ.
              Caso contrário, obtemos pelo idConsorcio === permitCode
           */
          if (ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL' || ordem.consorcio === 'TEC') {
            user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });
          } else {
            user = await this.usersService.getOne({ permitCode: ordem.idConsorcio });
          }
          if (user && !user.bloqueado) {
            this.logger.debug(`Salvando a ordem: ${ordem.idOrdemPagamento} para usuario: ${user.fullName}`, METHOD);
            await this.save(ordem, user.id);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
           ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
            await this.save(ordem, undefined);
          } else {
            this.logger.error(`Erro ao sincronizar ordem de pagamento ${ordem.id}: ${error.message}`, METHOD);
          }
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
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

  async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds: String, userId: number, endDateParam?: Date): Promise<OrdemPagamentoSemanalDto[]> {
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
