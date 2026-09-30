import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { getInicioDoDiaBrasilia } from 'src/utils/date-utils';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { HeaderName } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { ICnabInfo } from 'src/cnab/cnab.service';
import { RemessaService } from './remessa.service';
import {
  IDetalhamentoPorDia,
  ILimparPreparoResult,
  IPagamentoConsorcioPreparado,
  IPagamentoConsorcioPreparadoPaginado,
  PagamentoConsorcioRepository,
} from '../repository/pagamento-consorcio.repository';

/** Mesma lista usada pelo job de geração de remessa de modais (cron-jobs.service.ts). */
const MODAIS = ['STPC', 'STPL', 'TEC'];

@Injectable()
export class PagamentoModalService {
  private logger = new CustomLogger(PagamentoModalService.name, { timestamp: true });

  // Estado em memória do preparo assíncrono — o volume de modais (milhares de ordens,
  // uma por motorista/dia) faz "prepararPagamentos" levar minutos, tempo demais para
  // segurar uma requisição HTTP. O front dispara e consulta o status por polling.
  private preparando = false;
  private erroPreparacao: string | null = null;
  // Guardado pra a listagem (usada tanto na tela quanto na consulta pós-status) escopar
  // pelo mesmo período pedido no preparo, em vez de trazer tudo que já foi processado
  // hoje independente da data de captura pedida em cada chamada.
  private ultimoDataInicio: Date | null = null;
  private ultimoDataFim: Date | null = null;
  // Lembra se o último preparo foi de Gratuidade (pagador CETT) ou o normal, pra
  // "Gerar Remessa"/"Enviar para o Banco" (chamados depois, sem esse dado no request)
  // saberem qual HeaderName/agrupamento usar.
  private ultimoGratuidade = false;

  constructor(
    private remessaService: RemessaService,
    private pagamentoConsorcioRepository: PagamentoConsorcioRepository,
    private pagadorService: PagadorService,
    private usersService: UsersService,
  ) {}

  /**
   * Agrupa, por pessoa, as ordens de pagamento dos modais no período informado (só quem
   * tem dados bancários completos em `user`) e prepara o remessa (cria HeaderArquivo/
   * HeaderLote/DetalheA/DetalheB), sem gerar o TXT do CNAB nem enviar para o SFTP do
   * banco — essas duas últimas etapas ficam de fora por decisão de escopo.
   */
  async prepararPagamentos(dataInicio: Date, dataFim: Date, gratuidade = false): Promise<void> {
    this.ultimoDataInicio = dataInicio;
    this.ultimoDataFim = dataFim;
    this.ultimoGratuidade = gratuidade;

    const dataPagamento = getInicioDoDiaBrasilia();
    const pagadores = await this.pagadorService.getAllPagador();
    const pagador = gratuidade ? pagadores.cett : pagadores.contaBilhetagem;

    for (const modal of MODAIS) {
      this.logger.log(`Agrupando ordens do modal ${modal}${gratuidade ? ' (gratuidade)' : ''}`);
      const resultado = await this.pagamentoConsorcioRepository.agruparPorConsorcio(
        dataInicio,
        dataFim,
        dataPagamento,
        pagador.id,
        modal,
        gratuidade,
      );
      this.logger.log(
        `Modal ${modal}: ${resultado.agrupados} agrupado(s), ${resultado.semDadosBancarios} sem dados bancários, ${resultado.bloqueados} bloqueado(s)`,
      );
    }

    await this.remessaService.prepararRemessa(dataInicio, dataFim, dataPagamento, MODAIS, false, false, undefined, gratuidade);
  }

  /**
   * Dispara o preparo em segundo plano e retorna imediatamente — não segura a requisição
   * HTTP pelos minutos que o preparo real leva. Rejeita se já houver um preparo em
   * andamento (só um por vez, dado o estado em memória de instância única do serviço).
   */
  iniciarPreparacaoAssincrona(dataInicio: Date, dataFim: Date, gratuidade = false): void {
    if (this.preparando) {
      throw new HttpException({ error: 'Já existe uma preparação de modais em andamento.' }, HttpStatus.CONFLICT);
    }
    this.preparando = true;
    this.erroPreparacao = null;

    this.prepararPagamentos(dataInicio, dataFim, gratuidade)
      .catch((error) => {
        this.erroPreparacao = error?.message ?? 'Erro desconhecido ao preparar pagamentos.';
        this.logger.error(`Erro na preparação assíncrona de modais: ${this.erroPreparacao}`, error?.stack);
      })
      .finally(() => {
        this.preparando = false;
      });
  }

  getStatusPreparacao(): { preparando: boolean; erro: string | null } {
    return { preparando: this.preparando, erro: this.erroPreparacao };
  }

  async listarPreparadosAtual(page?: number, pageSize?: number, busca?: string): Promise<IPagamentoConsorcioPreparado[] | IPagamentoConsorcioPreparadoPaginado> {
    const dataPagamento = getInicioDoDiaBrasilia();
    return this.pagamentoConsorcioRepository.listarPreparados(dataPagamento, MODAIS, {
      dataInicio: this.ultimoDataInicio ?? undefined,
      dataFim: this.ultimoDataFim ?? undefined,
      busca,
      page,
      pageSize,
      gratuidade: this.ultimoGratuidade,
    });
  }

  async detalharPorDia(detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    return this.pagamentoConsorcioRepository.detalharPorDia(detalheAId);
  }

  /**
   * Desfaz o preparo atual (de hoje) dos modais, devolvendo as ordens ao estado
   * "não agrupada" para poderem ser preparadas de novo.
   */
  async limparPreparoAtual(): Promise<ILimparPreparoResult> {
    const dataPagamento = getInicioDoDiaBrasilia();
    return this.pagamentoConsorcioRepository.limparPreparo(dataPagamento, MODAIS);
  }

  /**
   * Gera o texto do arquivo CNAB 240 a partir da remessa já preparada (só leitura —
   * não envia nada para o banco). Só retorna dado se "Preparar Pagamentos" já tiver
   * rodado hoje (é o que cria o HeaderArquivo com status "remessaGerado").
   */
  async gerarRemessa(): Promise<ICnabInfo[]> {
    const headerName = this.ultimoGratuidade ? HeaderName.GRATUIDADE : HeaderName.MODAL;
    return this.remessaService.gerarCnabText(headerName, false, false, MODAIS, this.ultimoGratuidade);
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

    const headerName = this.ultimoGratuidade ? HeaderName.GRATUIDADE : HeaderName.MODAL;
    const listCnab = await this.remessaService.gerarCnabText(headerName, false, false, MODAIS, this.ultimoGratuidade);
    if (listCnab.length === 0) {
      throw new HttpException({ error: 'Nenhuma remessa gerada para enviar.' }, HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Enviando ${listCnab.length} arquivo(s) de remessa para o SFTP do banco (modais${this.ultimoGratuidade ? ' - gratuidade' : ''})`);
    await this.remessaService.enviarRemessa(listCnab, headerName);

    return { enviados: listCnab.length, arquivos: listCnab.map((c) => c.name) };
  }
}
