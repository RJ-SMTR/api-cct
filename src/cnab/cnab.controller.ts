import { BadRequestException, Controller, Get, HttpCode, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseListPipe } from 'src/utils/pipes/parse-list.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { CnabService } from './cnab.service';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDto } from './service/dto/extrato.dto';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { GetClienteFavorecidoConsorcioEnum } from './enums/get-cliente-favorecido-consorcio.enum';
import { ParseEnumPipe } from 'src/utils/pipes/validate-enum.pipe';

@ApiTags('Cnab')
@Controller({
  path: 'cnab',
  version: '1',
})
export class CnabController {
  private logger = new CustomLogger(CnabController.name, { timestamp: true });

  constructor(
    private readonly clienteFavorecidoService: ClienteFavorecidoService, //
    private readonly extratoHeaderArquivoService: ExtratoHeaderArquivoService,
    private readonly arquivoPublicacaoService: ArquivoPublicacaoService,
    private readonly cnabService: CnabService,
  ) {}

  @Get('clientes-favorecidos')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin, RoleEnum.admin_finan, RoleEnum.lancador_financeiro, RoleEnum.aprovador_financeiro)
  @ApiBearerAuth()
  @ApiQuery({ name: 'nome', description: 'Pesquisa por parte do nome, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'consorcio', description: 'Nome do consorcio', required: false, enum: GetClienteFavorecidoConsorcioEnum })
  @ApiQuery({ name: 'limit', description: ApiDescription({ _: 'Itens exibidos por página', min: 1 }), required: false, type: Number })
  @ApiQuery({ name: 'page', description: ApiDescription({ _: 'Itens exibidos por página', min: 1 }), required: false, type: Number })
  getClienteFavorecido(
    @Query('nome', new ParseArrayPipe({ items: String, separator: ',', optional: true })) nome: string[], //
    @Query('consorcio', new ParseEnumPipe(GetClienteFavorecidoConsorcioEnum, { optional: true })) consorcio: GetClienteFavorecidoConsorcioEnum | undefined,
    @Query('limit', new ParseNumberPipe({ min: 0, optional: true })) limit: number | undefined,
    @Query('page', new ParseNumberPipe({ min: 1, optional: true })) page: number | undefined,
  ): Promise<ClienteFavorecido[]> {
    return this.clienteFavorecidoService.findBy({ nome, limit, page, consorcio });
  }

  @Get('extratoLancamento')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin_finan, RoleEnum.lancador_financeiro, RoleEnum.aprovador_financeiro)
  @ApiBearerAuth()
  @ApiQuery({ name: 'conta', required: true, type: String })
  @ApiQuery({ name: 'dt_inicio', required: true, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'dt_fim', required: true, type: String, example: '2024-12-25' })
  @ApiQuery({ name: 'tipo', required: false, type: String, example: 'cett' })
  async getLancamentoExtrato(
    @Query('conta') conta: string, //
    @Query('dt_inicio', new ParseDatePipe()) dt_inicio: string,
    @Query('dt_fim', new ParseDatePipe()) dt_fim: string,
    @Query('tipo') tipoLancamento?: string,
  ): Promise<ExtratoDto[]> {
    return await this.extratoHeaderArquivoService.getExtrato(conta, dt_inicio, dt_fim, tipoLancamento);
  }

  @Get('arquivoPublicacao')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ description: `Endpoint para a equipe de dados (Bigquery) realizar a leitura das publicacoes de pagamentos realizados.` })
  @ApiBearerAuth()
  @ApiQuery({ name: 'dt_inicio', description: 'dataOrdem', required: true, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'dt_fim', description: 'dataOrdem', required: true, type: String, example: '2024-12-25' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  async getArquivoPublicacao(
    @Query('dt_inicio', new ParseDatePipe({ dateOnly: true, transform: true })) _dt_inicio: any, // Date
    @Query('dt_fim', new ParseDatePipe({ dateOnly: true, transform: true })) _dt_fim: any, // Date
    @Query('limit', new ParseNumberPipe({ min: 1, optional: true })) limit: number | undefined,
    @Query('page', new ParseNumberPipe({ min: 1, optional: true })) page: number | undefined,
  ) {
    const dataInicio = _dt_inicio as Date;
    const dataFim = _dt_fim as Date;
    const result = await this.arquivoPublicacaoService.findManyByDate(dataInicio, dataFim, limit, page);
    return result;
  }

  @Get('generateRemessa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - que normalmente é feita via cronjob' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'dataOrdemInicial', description: ApiDescription({ _: 'Data da Ordem de Pagamento Inicial - salvar transações', example: '2024-07-15' }), required: true, type: String })
  @ApiQuery({ name: 'dataOrdemFinal', description: ApiDescription({ _: 'Data da Ordem de Pagamento Final - salvar transações', example: '2024-07-16' }), required: true, type: String })
  @ApiQuery({ name: 'diasAnterioresOrdem', description: ApiDescription({ _: 'Procurar também por dias Anteriores a dataOrdemInicial - salvar transações', default: 0 }), required: false, type: Number, example: 7 })
  @ApiQuery({ name: 'consorcio', description: 'Nome do consorcio - salvar transações', required: true, type: String, example: 'Todos / Van / Empresa /Nome Consorcio' })
  @ApiQuery({ name: 'dt_pagamento', description: ApiDescription({ _: 'Data Pagamento', default: 'O dia de hoje' }), required: false, type: String })
  @ApiQuery({ name: 'isConference', description: 'Conferencia - Se o remessa será gerado numa tabela de teste.', required: true, type: Boolean, example: true })
  @ApiQuery({ name: 'isCancelamento', description: 'Cancelamento', required: true, type: Boolean, example: false })
  @ApiQuery({ name: 'nsaInicial', description: ApiDescription({ default: 'O NSA atual' }), required: false, type: Number })
  @ApiQuery({ name: 'nsaFinal', description: ApiDescription({ default: 'nsaInicial' }), required: false, type: Number })
  @ApiQuery({ name: 'dataCancelamento', description: ApiDescription({ _: 'Data de vencimento da transação a ser cancelada (DetalheA).', 'Required if': 'isCancelamento = true' }), required: false, type: String, example: '2024-07-16' })
  async getGenerateRemessa(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true })) _dataOrdemInicial: any, // Date
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true })) _dataOrdemFinal: any, // Date
    @Query('diasAnterioresOrdem', new ParseNumberPipe({ min: 0, defaultValue: 0 })) diasAnteriores: number,
    @Query('consorcio') consorcio: string,
    @Query('dt_pagamento', new ParseDatePipe({ transform: true, optional: true })) _dataPgto: any, // Date | undefined
    @Query('isConference') isConference: boolean,
    @Query('isCancelamento') isCancelamento: boolean,
    @Query('nsaInicial', new ParseNumberPipe({ min: 1, optional: true })) nsaInicial: number | undefined,
    @Query('nsaFinal', new ParseNumberPipe({ min: 1, optional: true })) nsaFinal: number | undefined,
    @Query('dataCancelamento', new ParseDatePipe({ transform: true, optional: true })) _dataCancelamento: any, // Date | undefined
  ) {
    const dataOrdemInicial = _dataOrdemInicial as Date;
    const dataOrdemFinal = _dataOrdemFinal as Date;
    const dataPgto = _dataOrdemFinal as Date | undefined;
    const dataCancelamento = _dataCancelamento as Date | undefined;

    if (isCancelamento && !dataCancelamento) {
      throw new BadRequestException('dataCancelamento é obrigatório se isCancelamento = true');
    }

    return await this.cnabService.getGenerateRemessa({
      dataOrdemInicial,
      dataOrdemFinal,
      diasAnteriores,
      consorcio,
      dataPgto,
      isConference,
      isCancelamento,
      nsaInicial,
      nsaFinal,
      dataCancelamento,
    });
  }

  @Get('updateRetorno')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a leitura do retorno - que normalmente é feita via cronjob' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'folder', description: ApiDescription({ _: 'Pasta para ler os retornos', default: '`/retorno`' }), required: false, type: String })
  @ApiQuery({ name: 'maxItems', description: ApiDescription({ _: 'Número máximo de itens para ler', min: 1 }), required: false, type: Number })
  async getUpdateRetorno(
    @Query('folder') folder: string | undefined, //
    @Query('maxItems', new ParseNumberPipe({ min: 1, optional: true })) maxItems: number | undefined,
  ) {
    return await this.cnabService.updateRetorno(folder, maxItems);
  }

  @Get('syncTransacaoViewOrdemPgto')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta o sincronismo de TransacaoView com as OrdensPagamento (ItemTransacaoAgrupado) - que normalmente é feia via cronjob' })
  @ApiQuery({ name: 'dataOrdemInicial', description: 'Data da Ordem de Pagamento Inicial', required: false, type: Date })
  @ApiQuery({ name: 'dataOrdemFinal', description: 'Data da Ordem de Pagamento Final', required: false, type: Date })
  @ApiQuery({ name: 'nomeFavorecido', description: 'Lista de nomes dos favorecidos', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getSyncTransacaoViewOrdemPgto(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true, optional: true })) dataOrdemInicial: Date | undefined, //
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true, optional: true })) dataOrdemFinal: Date | undefined,
    @Query('nomeFavorecido', new ParseListPipe({ transform: true, optional: true })) nomeFavorecido: string[] | undefined,
  ) {
    const dataOrdem_between = dataOrdemInicial && dataOrdemFinal && ([dataOrdemInicial, dataOrdemFinal] as [Date, Date]);
    return await this.cnabService.syncTransacaoViewOrdemPgto({ dataOrdem_between, nomeFavorecido });
  }

  @Get('updateTransacaoViewBigquery')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Atualiza TransacaoView do Bigquery' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'dataOrdemInicial', description: 'Data da Ordem de Pagamento Inicial', required: true, type: Date })
  @ApiQuery({ name: 'dataOrdemFinal', description: 'Data da Ordem de Pagamento Final', required: true, type: Date })
  @ApiQuery({ name: 'consorcio', description: ApiDescription({ _: 'Nome do consorcio - salvar transações', default: 'Todos' }), required: false, type: String, example: 'Todos / Van / Empresa /Nome Consorcio' })
  @ApiQuery({ name: 'idTransacao', description: 'Lista de idTransacao para atualizar', required: false, type: String })
  async getUpdateTransacaoViewBigquery(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true })) dataOrdemInicial: any, //
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true })) dataOrdemFinal: any,
    @Query('consorcio') consorcio: string | undefined,
    @Query('idTransacao', new ParseArrayPipe({ items: String, separator: ',', optional: true })) idTransacao: string[], //
  ) {
    const _dataOrdemInicial: Date = dataOrdemInicial;
    const _dataOrdemFinal: Date = dataOrdemFinal;
    const _consorcio = consorcio || 'Todos';
    return await this.cnabService.updateTransacaoViewBigquery(_dataOrdemInicial, _dataOrdemFinal, 0, _consorcio, idTransacao);
  }

  @Get('deduplicateTransacaoView')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nRemove duplicatas de TransacaoView' })
  @ApiBearerAuth()
  async getDeduplicateTransacaoView() {
    return await this.cnabService.deduplicateTransacaoView();
  }

  @Get('updateTransacaoViewBigqueryValues')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nAtualiza os valores de TransacaoView existentes a a partir do Bigquery.' })
  @ApiBearerAuth()
  async getUpdateTransacaoViewBigqueryValues() {
    return await this.cnabService.updateTransacaoViewBigqueryValues();
  }
}
