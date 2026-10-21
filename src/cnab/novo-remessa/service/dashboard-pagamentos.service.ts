import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DashboardPagamentosRepository, FiltroPeriodo } from '../repository/dashboard-pagamentos.repository';
import { DashboardPagamentosDetalheQueryDto } from '../dto/dashboard-pagamentos.dto';
import { ContaResumo, descreverMotivo, montarResumo } from './dashboard-pagamentos.utils';

/** Período máximo aceito (dias), para uma consulta não varrer o histórico inteiro. */
export const MAX_DIAS_DASHBOARD = 366;

/** Limite de linhas da exportação para Excel (uma linha por ordem), para não estourar a memória. */
export const MAX_LINHAS_EXPORTACAO = 150_000;

export function validarPeriodo({ dataInicio, dataFim }: FiltroPeriodo): void {
  const inicio = new Date(`${dataInicio}T00:00:00.000Z`);
  const fim = new Date(`${dataFim}T00:00:00.000Z`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio.toISOString().slice(0, 10) !== dataInicio || fim.toISOString().slice(0, 10) !== dataFim) {
    throw new HttpException({ error: 'Período inválido.' }, HttpStatus.BAD_REQUEST);
  }
  if (inicio > fim) {
    throw new HttpException({ error: 'dataInicio deve ser menor ou igual a dataFim.' }, HttpStatus.BAD_REQUEST);
  }
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  if (dias > MAX_DIAS_DASHBOARD) {
    throw new HttpException({ error: `O período máximo é de ${MAX_DIAS_DASHBOARD} dias (pedido: ${dias}).` }, HttpStatus.BAD_REQUEST);
  }
}

@Injectable()
export class DashboardPagamentosService {
  constructor(private readonly dashboardRepository: DashboardPagamentosRepository) {}

  async resumo(periodo: FiltroPeriodo): Promise<{ periodo: FiltroPeriodo; geradoEm: string; contas: ContaResumo[] }> {
    validarPeriodo(periodo);
    const linhas = await this.dashboardRepository.resumo(periodo);
    return { periodo, geradoEm: new Date().toISOString(), contas: montarResumo(linhas) };
  }

  async detalhe(filtro: DashboardPagamentosDetalheQueryDto) {
    validarPeriodo(filtro);
    const busca = filtro.busca?.trim() || undefined;
    if (busca !== undefined && busca.length < 2) {
      throw new HttpException({ error: 'Informe ao menos 2 caracteres para buscar o favorecido.' }, HttpStatus.BAD_REQUEST);
    }
    const page = filtro.page ?? 1;
    const pageSize = filtro.pageSize ?? 50;
    const resultado = await this.dashboardRepository.detalhe({ ...filtro, busca, page, pageSize });
    return {
      total: resultado.total,
      valorTotal: resultado.valorTotal,
      page,
      pageSize,
      itens: resultado.itens.map((item) => ({ ...item, valor: Number(item.valor), motivoDescricao: descreverMotivo(item.motivo) })),
    };
  }

  /**
   * Dados da exportação para Excel: uma linha por ordem que compõe cada pagamento do filtro (sem paginação),
   * já ordenadas por nome e data da ordem.
   */
  async exportar(filtro: DashboardPagamentosDetalheQueryDto) {
    validarPeriodo(filtro);
    const busca = filtro.busca?.trim() || undefined;
    if (busca !== undefined && busca.length < 2) {
      throw new HttpException({ error: 'Informe ao menos 2 caracteres para buscar o favorecido.' }, HttpStatus.BAD_REQUEST);
    }
    const restante = { ...filtro };
    delete restante.page;
    delete restante.pageSize;
    const linhas = await this.dashboardRepository.exportar({ ...restante, busca }, MAX_LINHAS_EXPORTACAO);
    if (linhas.length > MAX_LINHAS_EXPORTACAO) {
      throw new HttpException(
        { error: `A exportação passa de ${MAX_LINHAS_EXPORTACAO.toLocaleString('pt-BR')} linhas; reduza o período ou use mais filtros.` },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return {
      total: linhas.length,
      linhas: linhas.map((linha) => ({
        detalheAId: linha.detalheAId,
        nome: linha.nome,
        cpf: linha.cpf,
        dataOrdem: linha.dataOrdem,
        valorOrdem: linha.valorOrdem === null ? null : Number(linha.valorOrdem),
        valorLancamento: Number(linha.valorLancamento),
      })),
    };
  }
}
