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
import {
  IDetalhamentoPorDia,
  ILimparPreparoResult,
} from '../repository/pagamento-consorcio.repository';
import { IPagamentoGuardadorPreparado, PagamentoGuardadorRepository } from '../repository/pagamento-guardador.repository';

/**
 * Mesma ideia de PagamentoConsorcioService/PagamentoModalService, agora para o guardador —
 * segue os mesmos passos do job legado `remessaGuardadorExec` (cron-jobs.service.ts): agrupa
 * por pessoa usando a conta "contaRotativo" (não "contaBilhetagem", que é dos consórcios/
 * modais), prepara o remessa, gera o TXT do CNAB e permite enviar pro banco — sem chamar a
 * procedure legada `P_AGRUPAR_ORDENS_GUARDADOR` (nem sequer existe nesse banco local), já
 * que o agrupamento aqui é feito com a mesma lógica própria (bulk SQL + regra de bloqueado/
 * dados bancários) usada para consórcios e modais.
 */
@Injectable()
export class PagamentoGuardadorService {
  private logger = new CustomLogger(PagamentoGuardadorService.name, { timestamp: true });

  constructor(
    private remessaService: RemessaService,
    private detalheARepository: DetalheARepository,
    private pagamentoGuardadorRepository: PagamentoGuardadorRepository,
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
    private usersService: UsersService,
  ) {}

  async prepararPagamentos(dataInicio: Date, dataFim: Date): Promise<IPagamentoGuardadorPreparado[]> {
    const dataPagamento = getInicioDoDiaBrasilia();

    // Agrupamento pela procedure da main (`P_AGRUPAR_ORDENS_GUARDADOR`), a mesma usada pelos cron jobs.
    // Lista de consórcios vazia = fluxo de guardador no `prepararPagamentoAgrupados`.
    await this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicio, dataFim, dataPagamento, 'contaRotativo', []);
    const tiposAtualizados = await this.pagamentoGuardadorRepository.sincronizarTipoContaHistorico(dataPagamento, dataInicio, dataFim);
    this.logger.log(`Guardadores agrupados (${tiposAtualizados} histórico(s) com tipo de conta ajustado)`);

    await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, [], false);

    return (await this.pagamentoGuardadorRepository.listarPreparados(dataPagamento, { dataInicio, dataFim })) as IPagamentoGuardadorPreparado[];
  }

  async atualizarValorBi(detalheAId: number, novoValor: number, senha: string, requestUserId: number) {
    const requestUser = await this.usersService.findOne({ id: requestUserId });
    if (!requestUser) {
      throw new HttpException({ error: 'Usuário não encontrado.' }, HttpStatus.UNAUTHORIZED);
    }

    const senhaValida = await bcrypt.compare(senha, requestUser.password);
    if (!senhaValida) {
      throw new HttpException({ error: 'Senha incorreta.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const detalheA = await this.detalheARepository.getOne({ id: detalheAId });
    const valorAnterior = Number(detalheA.valorLancamento);
    const valorNovo = Math.round(novoValor * 100) / 100;

    await this.detalheARepository.save({ id: detalheAId, valorLancamento: valorNovo });
    await this.pagamentoGuardadorRepository.registrarAuditoria(detalheAId, requestUserId, valorAnterior, valorNovo);

    return { detalheAId, valorAnterior, valorNovo };
  }

  async listarAuditoria(detalheAId: number): Promise<DetalheAValorLancamentoAuditoria[]> {
    return this.pagamentoGuardadorRepository.listarAuditoria(detalheAId);
  }

  async detalharPorDia(detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    return this.pagamentoGuardadorRepository.detalharPorDia(detalheAId);
  }

  async limparPreparoAtual(): Promise<ILimparPreparoResult> {
    const dataPagamento = getInicioDoDiaBrasilia();
    return this.pagamentoGuardadorRepository.limparPreparo(dataPagamento);
  }

  async gerarRemessa(): Promise<ICnabInfo[]> {
    return this.remessaService.gerarCnabText(HeaderName.GUARDADOR, false, false, []);
  }

  async enviarParaBanco(senha: string, requestUserId: number): Promise<{ enviados: number; arquivos: string[] }> {
    const requestUser = await this.usersService.findOne({ id: requestUserId });
    if (!requestUser) {
      throw new HttpException({ error: 'Usuário não encontrado.' }, HttpStatus.UNAUTHORIZED);
    }

    const senhaValida = await bcrypt.compare(senha, requestUser.password);
    if (!senhaValida) {
      throw new HttpException({ error: 'Senha incorreta.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const listCnab = await this.remessaService.gerarCnabText(HeaderName.GUARDADOR, false, false, []);
    if (listCnab.length === 0) {
      throw new HttpException({ error: 'Nenhuma remessa gerada para enviar.' }, HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Enviando ${listCnab.length} arquivo(s) de remessa para o SFTP do banco (guardador)`);
    await this.remessaService.enviarRemessa(listCnab, HeaderName.GUARDADOR);

    return { enviados: listCnab.length, arquivos: listCnab.map((c) => c.name) };
  }
}
