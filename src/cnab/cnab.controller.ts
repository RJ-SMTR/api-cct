import { Controller, Get, HttpCode, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { CnabService } from './cnab.service';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDto } from './service/dto/extrato.dto';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ParseListPipe } from 'src/utils/pipes/parse-list.pipe';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateInterval } from 'src/utils/date-utils';

@ApiTags('Cnab')
@Controller({
  path: 'cnab',
  version: '1',
})
export class CnabController {
  private logger = new CustomLogger(CnabController.name, { timestamp: true });

  constructor(private readonly clienteFavorecidoService: ClienteFavorecidoService, private readonly extratoHeaderArquivoService: ExtratoHeaderArquivoService, private readonly arquivoPublicacaoService: ArquivoPublicacaoService, private readonly cnabService: CnabService) {}

  @Get('clientes-favorecidos')
  @ApiQuery({ name: 'nome', description: 'Pesquisa por parte do nome, sem distinção de acento ou maiúsculas.', required: false, type: String, example: 'joao' })
  @ApiQuery({ name: 'limit', description: 'Itens exibidos por página', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'page', description: ApiDescription({ description: 'Itens exibidos por página', min: 1 }), required: false, type: Number, example: 1 })
  getClienteFavorecido(
    @Query('nome', new ParseArrayPipe({ items: String, separator: ',', optional: true })) nome: string[], //
    @Query('limit', new ParseNumberPipe({ min: 0, optional: true })) limit: number,
    @Query('page', new ParseNumberPipe({ min: 1, optional: true })) page: number,
  ): Promise<ClienteFavorecido[]> {
    // const treatedNome = nome.map((n) => getStringUpperUnaccent(n));
    return this.clienteFavorecidoService.findBy({ nome, limit, page });
  }

  @ApiQuery({ name: 'conta', required: true, type: String })
  @ApiQuery({ name: 'dt_inicio', required: true, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'dt_fim', required: true, type: String, example: '2024-12-25' })
  @ApiQuery({ name: 'tipo', required: false, type: String, example: 'cett' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin_finan, RoleEnum.lancador_financeiro, RoleEnum.aprovador_financeiro)
  @Get('extratoLancamento')
  async getLancamentoExtrato(
    @Query('conta') conta: string, //
    @Query('dt_inicio', new ParseDatePipe()) dt_inicio: string,
    @Query('dt_fim', new ParseDatePipe()) dt_fim: string,
    @Query('tipo') tipoLancamento?: string,
  ): Promise<ExtratoDto[]> {
    return await this.extratoHeaderArquivoService.getExtrato(conta, dt_inicio, dt_fim, tipoLancamento);
  }

  @ApiQuery({ name: 'dt_inicio', description: 'dataOrdem', required: true, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'dt_fim', description: 'dataOrdem', required: true, type: String, example: '2024-12-25' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('arquivoPublicacao')
  async getArquivoPublicacao(
    @Query('dt_inicio', new ParseDatePipe()) dt_inicio: string, //
    @Query('dt_fim', new ParseDatePipe()) dt_fim: string,
  ) {
    return await this.arquivoPublicacaoService.findManyByDate(new Date(dt_inicio + ' '), new Date(dt_fim + ' '));
  }

  @ApiQuery({ name: 'dataOrdemInicial', description: 'Data da Ordem de Pagamento Inicial - salvar transações', required: true, type: String, example: '2024-07-15' })
  @ApiQuery({ name: 'dataOrdemFinal', description: 'Data da Ordem de Pagamento Final - salvar transações', required: true, type: String, example: '2024-07-16' })
  @ApiQuery({ name: 'diasAnterioresOrdem', description: ApiDescription({ _: 'Procurar também por dias Anteriores a dataOrdemInicial - salvar transações', default: 0 }), required: false, type: Number, example: 7 })
  @ApiQuery({ name: 'consorcio', description: 'Nome do consorcio - salvar transações', required: true, type: String, example: 'Todos / Van / Empresa /Nome Consorcio' })
  @ApiQuery({ name: 'dt_pagamento', description: ApiDescription({ _: 'Data Pagamento', default: 'O dia de hoje' }), required: false, type: String })
  @ApiQuery({ name: 'isConference', description: 'Conferencia - Se o remessa será gerado numa tabela de teste.', required: true, type: Boolean, example: true })
  @ApiQuery({ name: 'isCancelamento', description: 'Cancelamento', required: true, type: Boolean, example: false })
  @ApiQuery({ name: 'nsaInicial', description: ApiDescription({ default: 'O NSA atual' }), required: false, type: Number })
  @ApiQuery({ name: 'nsaFinal', description: ApiDescription({ default: 'nsaInicial' }), required: false, type: Number })
  @ApiQuery({ name: 'dataCancelamento', description: ApiDescription({ _: 'Data de vencimento da transação a ser cancelada (DetalheA).', 'Required if': 'isCancelamento = true' }), required: false, type: String, example: '2024-07-16' })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('generateRemessa')
  async getGenerateRemessa(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true })) dataOrdemInicial: Date, //
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true })) dataOrdemFinal: Date,
    @Query('diasAnterioresOrdem', new ParseNumberPipe({ min: 0, defaultValue: 0 })) diasAnteriores: number,
    @Query('consorcio') consorcio: string,
    @Query('dt_pagamento', new ParseDatePipe({ transform: true, optional: true })) dataPgto: Date | undefined,
    @Query('isConference') isConference: boolean,
    @Query('isCancelamento') isCancelamento: boolean,
    @Query('nsaInicial', new ParseNumberPipe({ min: 1, optional: true })) nsaInicial: number | undefined,
    @Query('nsaFinal', new ParseNumberPipe({ min: 1, optional: true })) nsaFinal: number | undefined,
    @Query('dataCancelamento', new ParseDatePipe({ transform: true, optional: true })) dataCancelamento: Date | undefined,
  ) {
    const METHOD = 'getGenerateRemessa';
    if (isCancelamento && !dataCancelamento) {
      throw CommonHttpException.message('dataCancelamento é obrigatório se isCancelamento = true');
    }
    const duration = { saveTransacoesJae: '', generateRemessa: '', sendRemessa: '', total: '' };
    const startDate = new Date();
    let now = new Date();
    this.logger.log('Tarefa iniciada', METHOD);

    this.logger.log('saveTransacoesJae iniciado');
    await this.cnabService.saveTransacoesJae(dataOrdemInicial, dataOrdemFinal, diasAnteriores, consorcio);
    duration.saveTransacoesJae = formatDateInterval(new Date(), now);
    now = new Date();
    this.logger.log(`saveTransacoesJae finalizado - ${duration.saveTransacoesJae}`);

    this.logger.log('generateRemessa started');
    const listCnab = await this.cnabService.generateRemessa({
      tipo: PagadorContaEnum.ContaBilhetagem, //
      dataPgto,
      isConference,
      isCancelamento,
      nsaInicial,
      nsaFinal,
      dataCancelamento,
    });
    duration.generateRemessa = formatDateInterval(new Date(), now);
    now = new Date();
    this.logger.log(`generateRemessa finalizado - ${duration.generateRemessa}`);

    this.logger.log('sendRemessa started');
    await this.cnabService.sendRemessa(listCnab);
    duration.sendRemessa = formatDateInterval(new Date(), now);
    this.logger.log(`sendRemessa finalizado - ${duration.sendRemessa}`);

    duration.total = formatDateInterval(new Date(), startDate);
    this.logger.log(`Tarefa finalizada - ${duration.total}`);
    return {
      duration,
      cnabs: listCnab,
    };
  }

  @ApiQuery({ name: 'folder', description: ApiDescription({  _: 'Pasta para ler os retornos', default: '/retorno' }), required: false, type: String })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @Get('updateRetorno')
  async getUpdateRetorno(
    @Query('folder', new ParseDatePipe()) folder: string | undefined, //
  ) {
    return await this.cnabService.updateRetorno(folder);
  }

  @ApiQuery({ name: 'dataOrdemInicial', description: 'Data da Ordem de Pagamento Inicial', required: true, type: Date })
  @ApiQuery({ name: 'dataOrdemFinal', description: 'Data da Ordem de Pagamento Final', required: true, type: Date })
  @ApiQuery({ name: 'nomeFavorecido', description: 'Lista de nomes dos favorecidos', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('syncTransacaoViewOrdemPgto')
  async getSyncTransacaoViewOrdemPgto(
    @Query('dataOrdemInicial', new ParseDatePipe()) dataOrdemInicial: string, //
    @Query('dataOrdemFinal', new ParseDatePipe()) dataOrdemFinal: string,
    @Query('nomeFavorecido', new ParseListPipe({ transform: true, optional: true })) nomeFavorecido: string[],
  ) {
    return await this.cnabService.sincronizeTransacaoViewOrdemPgto(dataOrdemInicial, dataOrdemFinal, nomeFavorecido);
  }
}
