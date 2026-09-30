import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { getInicioDoDiaBrasilia } from 'src/utils/date-utils';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { DetalheAValorLancamentoAuditoria } from 'src/cnab/entity/pagamento/detalhe-a-valor-lancamento-auditoria.entity';
import { DetalheARepository } from 'src/cnab/repository/pagamento/detalhe-a.repository';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { ICnabInfo } from 'src/cnab/cnab.service';
import { RemessaService } from './remessa.service';
import {
  IDetalhamentoPorDia,
  ILimparPreparoResult,
  IPagamentoConsorcioPreparado,
  PagamentoConsorcioRepository,
} from '../repository/pagamento-consorcio.repository';

/** Mesma lista usada pelo job de geração de remessa (cron-jobs.service.ts). */
const CONSORCIOS = ['VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'GTU'];

@Injectable()
export class PagamentoConsorcioService {
  private logger = new CustomLogger(PagamentoConsorcioService.name, { timestamp: true });

  constructor(
    private remessaService: RemessaService,
    private detalheARepository: DetalheARepository,
    private pagamentoConsorcioRepository: PagamentoConsorcioRepository,
    private pagadorService: PagadorService,
    private usersService: UsersService,
  ) {}

  /**
   * Agrupa, por pessoa, as ordens de pagamento dos consórcios no período informado
   * (só quem tem dados bancários completos em `user`) e prepara o remessa (cria
   * HeaderArquivo/HeaderLote/DetalheA/DetalheB), sem gerar o TXT do CNAB nem enviar
   * para o SFTP do banco — essas duas últimas etapas ficam de fora por decisão de escopo.
   */
  async prepararPagamentos(dataInicio: Date, dataFim: Date): Promise<IPagamentoConsorcioPreparado[]> {
    const dataPagamento = getInicioDoDiaBrasilia();
    const pagador = (await this.pagadorService.getAllPagador()).contaBilhetagem;

    for (const consorcio of CONSORCIOS) {
      this.logger.log(`Agrupando ordens do consórcio ${consorcio}`);
      const resultado = await this.pagamentoConsorcioRepository.agruparPorConsorcio(dataInicio, dataFim, dataPagamento, pagador.id, consorcio);
      this.logger.log(
        `Consórcio ${consorcio}: ${resultado.agrupados} agrupado(s), ${resultado.semDadosBancarios} sem dados bancários, ${resultado.bloqueados} bloqueado(s)`,
      );
    }

    await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, CONSORCIOS, false);

    return (await this.pagamentoConsorcioRepository.listarPreparados(dataPagamento, CONSORCIOS, {
      dataInicio,
      dataFim,
    })) as IPagamentoConsorcioPreparado[];
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
    // Arredonda para 2 casas decimais (padrão BRL) antes de persistir, evitando que
    // imprecisão de ponto flutuante do JS grave um valor divergente do exibido na tela.
    const valorNovo = Math.round(novoValor * 100) / 100;

    await this.detalheARepository.save({ id: detalheAId, valorLancamento: valorNovo });
    await this.pagamentoConsorcioRepository.registrarAuditoria(detalheAId, requestUserId, valorAnterior, valorNovo);

    return { detalheAId, valorAnterior, valorNovo };
  }

  async listarAuditoria(detalheAId: number): Promise<DetalheAValorLancamentoAuditoria[]> {
    return this.pagamentoConsorcioRepository.listarAuditoria(detalheAId);
  }

  async detalharPorDia(detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    return this.pagamentoConsorcioRepository.detalharPorDia(detalheAId);
  }

  /**
   * Desfaz o preparo atual (de hoje) dos consórcios, devolvendo as ordens ao estado
   * "não agrupada" para poderem ser preparadas de novo.
   */
  async limparPreparoAtual(): Promise<ILimparPreparoResult> {
    const dataPagamento = getInicioDoDiaBrasilia();
    return this.pagamentoConsorcioRepository.limparPreparo(dataPagamento, CONSORCIOS);
  }

  /**
   * Gera o texto do arquivo CNAB 240 a partir da remessa já preparada (só leitura —
   * não envia nada para o banco). Só retorna dado se "Preparar Pagamentos" já tiver
   * rodado hoje (é o que cria o HeaderArquivo com status "remessaGerado").
   */
  async gerarRemessa(): Promise<ICnabInfo[]> {
    return this.remessaService.gerarCnabText(HeaderName.CONSORCIO, false, false, CONSORCIOS);
  }

  /**
   * Envia a remessa já gerada para o SFTP do banco. Regenera o CNAB no servidor (nunca
   * confia em conteúdo vindo do front) e exige confirmação de senha do usuário logado,
   * já que essa etapa é externa e não pode ser desfeita depois de enviada.
   */
  async enviarParaBanco(senha: string, requestUserId: number): Promise<{ enviados: number; arquivos: string[] }> {
    const requestUser = await this.usersService.findOne({ id: requestUserId });
    if (!requestUser) {
      throw new HttpException({ error: 'Usuário não encontrado.' }, HttpStatus.UNAUTHORIZED);
    }

    const senhaValida = await bcrypt.compare(senha, requestUser.password);
    if (!senhaValida) {
      throw new HttpException({ error: 'Senha incorreta.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const listCnab = await this.remessaService.gerarCnabText(HeaderName.CONSORCIO, false, false, CONSORCIOS);
    if (listCnab.length === 0) {
      throw new HttpException({ error: 'Nenhuma remessa gerada para enviar.' }, HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Enviando ${listCnab.length} arquivo(s) de remessa para o SFTP do banco (consórcios)`);
    await this.remessaService.enviarRemessa(listCnab, HeaderName.CONSORCIO);

    return { enviados: listCnab.length, arquivos: listCnab.map((c) => c.name) };
  }
}
