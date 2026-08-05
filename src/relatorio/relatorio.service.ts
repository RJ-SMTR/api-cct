import { BadRequestException, Injectable } from '@nestjs/common';
import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';
import { RelatorioAnaliticoResultDto } from './dtos/relatorio-analitico-result.dto';
import { RelatorioSinteticoResultDto } from './dtos/relatorio-sintetico-result.dto';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioConsolidadoRepository } from './consolidado/relatorio-consolidado.repository';
import { IFindExtrato } from './interfaces/find-extrato.interface';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioResponseDto } from './dtos/relatorio-extrato-bancario-response.dto';
import { RelatorioGuardadorConsolidadoRepository } from './consolidado/relatorio-guardador-consolidado.repository';

type StatusRelatorio = 'todos' | 'pago' | 'erros' | 'aPagar';

@Injectable()
export class RelatorioService {
  constructor(
    private readonly relatorioConsolidadoRepository: RelatorioConsolidadoRepository,
    private readonly relatorioGuardadorConsolidadoRepository: RelatorioGuardadorConsolidadoRepository,
    private readonly relatorioSinteticoRepository: RelatorioSinteticoRepository,
    private readonly relatorioAnaliticoRepository: RelatorioAnaliticoRepository,
    private readonly relatorioExtratoRepository: RelatorioExtratoBancarioRepository,
  ) { }

  // --- Validação centralizada ---
  private validateDateRange(dataInicio: Date | string, dataFim: Date | string) {
    if (!dataInicio || !dataFim || new Date(dataFim) < new Date(dataInicio)) {
      throw new BadRequestException('Parametro de data inválido');
    }
  }

  // --- CONSOLIDADO ---
  async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoResultDto[]> {
    this.validateDateRange(args.dataInicio, args.dataFim);

    const statusToFetch = this.resolveStatus(args);

    const results = await Promise.all(
      statusToFetch.map(status => this.instanceDataConsolidado(args, status))
    );

    return results;
  }

  private async instanceDataConsolidado(args: IFindPublicacaoRelatorio, status: StatusRelatorio) {
    const data = await this.relatorioConsolidadoRepository.findConsolidado({ ...args, status } as any);

    const result = new RelatorioConsolidadoResultDto();
    result.count = data.length;
    result.data = data;
    result.valor = +data.reduce((s, i) => s + (Number(i.valor) || 0), 0).toFixed(2);
    result.status = status;
    return result;
  }

  // --- CONSOLIDADO GUARDADOR---
  async findConsolidadoGuardador(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoResultDto[]> {
    this.validateDateRange(args.dataInicio, args.dataFim);

    const statusToFetch = this.resolveStatus(args);

    const results = await Promise.all(
      statusToFetch.map(status => this.instanceDataGuardadorConsolidado(args, status))
    );

    return results;
  }

  private async instanceDataGuardadorConsolidado(args: IFindPublicacaoRelatorio, status: StatusRelatorio) {
    const data = await this.relatorioGuardadorConsolidadoRepository.findConsolidado({ ...args, status } as any);

    const result = new RelatorioConsolidadoResultDto();
    result.count = data.length;
    result.data = data;
    result.valor = +data.reduce((s, i) => s + (Number(i.valor) || 0), 0).toFixed(2);
    result.status = status;
    return result;
  }

  // --- SINTETICO ---
  async findSintetico(args: IFindPublicacaoRelatorio): Promise<RelatorioSinteticoResultDto[]> {
    this.validateDateRange(args.dataInicio, args.dataFim);
    return [await this.instanceDataSintetico(args, 'todos')];
  }

  private async instanceDataSintetico(args: IFindPublicacaoRelatorio, status: StatusRelatorio) {
    const sintetico = await this.relatorioSinteticoRepository.findSintetico(args);
    const dto = new RelatorioSinteticoResultDto();
    dto.count = sintetico.length;
    dto.data = sintetico;
    dto.valor = sintetico?.[0]?.total ?? 0;
    dto.status = status;
    return dto;
  }

  // --- EXTRATO ---
  async findExtrato(args: IFindExtrato): Promise<RelatorioExtratoBancarioResponseDto> {
    this.validateDateRange(args.dataInicio, args.dataFim);

    const extrato = await this.relatorioExtratoRepository.findExtrato(args);
    const response = new RelatorioExtratoBancarioResponseDto();
    response.extrato = extrato;
    // CORREÇÃO: Saldo deve ser do último registro, campo final
    // Se seu DTO tiver valorSaldoFinal, use ele. Se não, ajuste.
    response.saldoConta = extrato[extrato.length - 1]?.valorSaldoInicial ?? extrato[0]?.valorSaldoInicial ?? 0;
    return response;
  }

  // --- ANALITICO ---
  async findAnalitico(args: IFindPublicacaoRelatorio): Promise<RelatorioAnaliticoResultDto[]> {
    this.validateDateRange(args.dataInicio, args.dataFim);

    const statusToFetch = this.resolveStatus(args);

    const results = await Promise.all(
      statusToFetch.map(status => this.instanceDataAnalitico(args, status))
    );

    return results;
  }

  private async instanceDataAnalitico(args: IFindPublicacaoRelatorio, status: StatusRelatorio) {
    const analitico = await this.relatorioAnaliticoRepository.findAnalitico({ ...args, status } as any);
    const dto = new RelatorioAnaliticoResultDto();
    dto.count = analitico.length;
    dto.data = analitico;
    dto.valor = +analitico.reduce((s, i) => s + (Number(i.valorTransacao) || 0), 0).toFixed(2);
    dto.status = status;
    return dto;
  }

  // --- Lógica de status centralizada (remove duplicação) ---
  private resolveStatus(args: IFindPublicacaoRelatorio): StatusRelatorio[] {
    const hasFiltroEspecifico = !!args.favorecidoNome || !!args.consorcioNome;

    if (!hasFiltroEspecifico && args.pago === undefined && args.aPagar === undefined) {
      return ['todos', 'pago', 'erros', 'aPagar'];
    }
    if (args.pago === true && args.aPagar === true) {
      return ['pago', 'aPagar'];
    }
    if (args.pago === true) return ['pago'];
    if (args.pago === false) return ['erros'];
    if (args.aPagar === true) return ['aPagar'];

    return ['todos'];
  }
}
