import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { getInicioDoDiaBrasilia } from 'src/utils/date-utils';
import { DetalheAValorLancamentoAuditoria } from 'src/cnab/entity/pagamento/detalhe-a-valor-lancamento-auditoria.entity';
import { DetalheARepository } from 'src/cnab/repository/pagamento/detalhe-a.repository';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { ICnabInfo } from 'src/cnab/cnab.service';
import { RemessaService } from './remessa.service';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { IDetalhamentoPorDia, ILimparPreparoResult, PagamentoConsorcioRepository } from '../repository/pagamento-consorcio.repository';
import { IPagamentoPendentePreparado, MODAIS_PENDENTES, PagamentoPendenteRepository, TipoPendente } from '../repository/pagamento-pendente.repository';

export type { TipoPendente };

export const TIPOS_PENDENTE: TipoPendente[] = ['permissionarios', 'guardadores'];

/**
 * Pagamentos pendentes (ordens/agrupamentos que falharam ou nunca foram pagos), com os mesmos passos dos pagamentos
 * normais: preparar, limpar preparo, gerar remessa e enviar ao banco. Permissionários (STPC/STPL/TEC) usam o fluxo
 * de `remessaPendenteExec` e guardadores o de `pagamentoPendentesGuardadoresExec`, só que em etapas separadas, com
 * conferência do que foi preparado antes de gerar e enviar.
 */
@Injectable()
export class PagamentoPendenteService {
  private logger = new CustomLogger(PagamentoPendenteService.name, { timestamp: true });
  private readonly emExecucao = new Set<string>();

  constructor(
    private remessaService: RemessaService,
    private detalheARepository: DetalheARepository,
    private pendenteRepository: PagamentoPendenteRepository,
    private auditoriaRepository: PagamentoConsorcioRepository,
    private usersService: UsersService,
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
  ) {}

  private headerName(tipo: TipoPendente) {
    // Mesmos cabeçalhos dos jobs: remessaPendenteExec usa MODAL e pagamentoPendentesGuardadoresExec usa GUARDADOR.
    return tipo === 'permissionarios' ? HeaderName.MODAL : HeaderName.GUARDADOR;
  }

  /** Evita duas ações de remessa do mesmo tipo ao mesmo tempo (preparar, limpar, enviar). */
  private async exclusivo<T>(tipo: TipoPendente, acao: string, fn: () => Promise<T>): Promise<T> {
    if (this.emExecucao.has(tipo)) {
      throw new HttpException({ error: 'Já existe uma operação de pendentes em andamento. Aguarde terminar.' }, HttpStatus.CONFLICT);
    }
    this.emExecucao.add(tipo);
    try {
      return await fn();
    } finally {
      this.emExecucao.delete(tipo);
      this.logger.log(`Pendentes ${tipo}: ${acao} finalizado`, 'exclusivo');
    }
  }

  private async confirmarSenha(senha: string, usuarioId: number) {
    const usuario = await this.usersService.findOne({ id: usuarioId });
    if (!usuario) {
      throw new HttpException({ error: 'Usuário não encontrado.' }, HttpStatus.UNAUTHORIZED);
    }
    if (!(await bcrypt.compare(senha ?? '', usuario.password))) {
      throw new HttpException({ error: 'Senha incorreta.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  /**
   * Agrupa os pendentes do período (as procedures criam o agrupamento "pai" do dia) e prepara o remessa
   * (HeaderArquivo/HeaderLote/DetalheA/DetalheB), sem gerar o TXT nem enviar ao banco.
   */
  async prepararPagamentos(tipo: TipoPendente, dataInicio: Date, dataFim: Date): Promise<IPagamentoPendentePreparado[]> {
    return this.exclusivo(tipo, 'preparar', async () => {
      const dataPagamento = getInicioDoDiaBrasilia();
      if (tipo === 'permissionarios') {
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupadosPendentes(dataInicio, dataFim, dataPagamento, 'contaBilhetagem');
      } else {
        await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupadosGuardadorPendentes(dataInicio, dataFim, dataPagamento, 'contaRotativo');
      }
      const tiposAtualizados = await this.pendenteRepository.sincronizarTipoContaHistorico(tipo, dataPagamento);
      this.logger.log(`Pendentes ${tipo} agrupados (${tiposAtualizados} histórico(s) com tipo de conta ajustado)`);

      await this.remessaService.prepararRemessa(
        dataInicio,
        dataFim,
        dataPagamento,
        tipo === 'permissionarios' ? MODAIS_PENDENTES : [],
        false,
        true,
      );
      return this.pendenteRepository.listarPreparados(tipo, dataPagamento);
    });
  }

  async listarPreparados(tipo: TipoPendente): Promise<IPagamentoPendentePreparado[]> {
    return this.pendenteRepository.listarPreparados(tipo, getInicioDoDiaBrasilia());
  }

  async atualizarValorBi(detalheAId: number, novoValor: number, senha: string, requestUserId: number) {
    await this.confirmarSenha(senha, requestUserId);
    const detalheA = await this.detalheARepository.getOne({ id: detalheAId });
    const valorAnterior = Number(detalheA.valorLancamento);
    const valorNovo = Math.round(novoValor * 100) / 100;
    await this.detalheARepository.save({ id: detalheAId, valorLancamento: valorNovo });
    await this.auditoriaRepository.registrarAuditoria(detalheAId, requestUserId, valorAnterior, valorNovo);
    return { detalheAId, valorAnterior, valorNovo };
  }

  async listarAuditoria(detalheAId: number): Promise<DetalheAValorLancamentoAuditoria[]> {
    return this.auditoriaRepository.listarAuditoria(detalheAId);
  }

  async detalharPorDia(tipo: TipoPendente, detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    return this.pendenteRepository.detalharPorDia(tipo, detalheAId);
  }

  async limparPreparoAtual(tipo: TipoPendente): Promise<ILimparPreparoResult> {
    return this.exclusivo(tipo, 'limpar preparo', () => this.pendenteRepository.limparPreparo(tipo, getInicioDoDiaBrasilia()));
  }

  /** Gera o texto do CNAB da remessa já preparada (só leitura: não envia nada ao banco). */
  async gerarRemessa(tipo: TipoPendente): Promise<ICnabInfo[]> {
    return this.remessaService.gerarCnabText(this.headerName(tipo), undefined, true, tipo === 'permissionarios' ? MODAIS_PENDENTES : []);
  }

  /**
   * Envia a remessa preparada ao SFTP do banco. Regenera o CNAB no servidor (nunca confia no conteúdo do front) e
   * exige a senha do usuário logado, já que a etapa é externa e não se desfaz.
   */
  async enviarParaBanco(tipo: TipoPendente, senha: string, requestUserId: number): Promise<{ enviados: number; arquivos: string[] }> {
    await this.confirmarSenha(senha, requestUserId);
    return this.exclusivo(tipo, 'enviar ao banco', async () => {
      const listCnab = await this.gerarRemessa(tipo);
      if (listCnab.length === 0) {
        throw new HttpException({ error: 'Nenhuma remessa gerada para enviar.' }, HttpStatus.BAD_REQUEST);
      }
      this.logger.log(`Pendentes ${tipo}: usuário ${requestUserId} enviando ${listCnab.length} arquivo(s) ao SFTP do banco`);
      await this.remessaService.enviarRemessa(listCnab, this.headerName(tipo));
      return { enviados: listCnab.length, arquivos: listCnab.map((c) => c.name) };
    });
  }
}
