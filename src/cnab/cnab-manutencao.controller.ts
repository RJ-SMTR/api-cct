import { BadRequestException, Controller, Get, HttpCode, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { ParseArrayPipe as ParseArrayPipe1 } from 'src/utils/pipes/parse-array.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { CnabService } from './cnab.service';
import { HeaderArquivo } from './entity/pagamento/header-arquivo.entity';
import { HeaderArquivoStatus } from './enums/pagamento/header-arquivo-status.enum';
import { ParseEnumPipe } from 'src/utils/pipes/parse-enum.pipe';

@ApiTags('Manutenção')
@Controller({
  path: 'manutencao/cnab',
  version: '1',
})
export class CnabManutencaoController {
  private logger = new CustomLogger(CnabManutencaoController.name, { timestamp: true });

  constructor(private readonly cnabService: CnabService) {}

  @Get('generateRemessaLancamento')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - que normalmente é feita via cronjob.' })
  @ApiQuery({ name: 'dataOrdemInicial', type: String, required: false, description: ApiDescription({ _: 'Data da Ordem de Pagamento Inicial - salvar transações', example: '2024-07-15' }) })
  @ApiQuery({ name: 'dataOrdemFinal', type: String, required: false, description: ApiDescription({ _: 'Data da Ordem de Pagamento Final - salvar transações', example: '2024-07-16' }) })
  @ApiQuery({ name: 'dataPagamento', type: String, required: false, description: ApiDescription({ _: 'Data de pagamento', default: 'O dia de hoje' }) })
  @ApiQuery({ name: 'isConference', type: Boolean, required: true, description: 'Conferencia - Se o remessa será gerado numa tabela de teste.', example: true })
  @ApiQuery({ name: 'isCancelamento', type: Boolean, required: true, description: 'Cancelamento', example: false })
  @ApiQuery({ name: 'isTeste', type: Boolean, required: true, description: 'Define se o CNAB Remessa usará o parâmetro de Teste', example: false })
  @ApiQuery({ name: 'nsaInicial', type: Number, required: false, description: ApiDescription({ default: 'O NSA atual' }) })
  @ApiQuery({ name: 'nsaFinal', type: Number, required: false, description: ApiDescription({ default: 'nsaInicial' }) })
  @ApiQuery({ name: 'dataCancelamento', type: String, required: false, description: ApiDescription({ _: 'Data de vencimento da transação a ser cancelada (DetalheA).', 'Required if': 'isCancelamento = true' }), example: '2024-07-16' })
  @ApiBearerAuth()
  async getGenerateRemessaLancamento(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true, optional: true })) _dataOrdemInicial: any, // Date
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true, optional: true })) _dataOrdemFinal: any, // Date
    @Query('dataPagamento', new ParseDatePipe({ transform: true, optional: true })) dataPagamento: Date | undefined, // Date | undefined
    @Query('isConference') isConference: boolean,
    @Query('isCancelamento') isCancelamento: boolean,
    @Query('isTeste') isTeste: boolean,
    @Query('nsaInicial', new ParseNumberPipe({ min: 1, optional: true })) nsaInicial: number | undefined,
    @Query('nsaFinal', new ParseNumberPipe({ min: 1, optional: true })) nsaFinal: number | undefined,
    @Query('dataCancelamento', new ParseDatePipe({ transform: true, optional: true })) _dataCancelamento: any, // Date | undefined
  ) {
    const dataOrdemInicial = _dataOrdemInicial as Date | undefined;
    const dataOrdemFinal = _dataOrdemFinal as Date | undefined;
    const dataCancelamento = _dataCancelamento as Date | undefined;

    if (isCancelamento && !dataCancelamento) {
      throw new BadRequestException('dataCancelamento é obrigatório se isCancelamento = true');
    }

    return await this.cnabService.generateRemessaLancamento({
      dataOrdemInicial,
      dataOrdemFinal,
      dataPgto: dataPagamento,
      isConference,
      isCancelamento,
      isTeste,
      nsaInicial,
      nsaFinal,
      dataCancelamento,
    });
  }

  @Get('generateRemessaJae')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - que normalmente é feita via cronjob' })
  @ApiQuery({ name: 'dataOrdemInicial', description: ApiDescription({ _: 'Data da Ordem de Pagamento Inicial - salvar transações', example: '2024-07-15' }), required: true, type: String })
  @ApiQuery({ name: 'dataOrdemFinal', description: ApiDescription({ _: 'Data da Ordem de Pagamento Final - salvar transações', example: '2024-07-16' }), required: true, type: String })
  @ApiQuery({ name: 'diasAnterioresOrdem', description: ApiDescription({ _: 'Procurar também por dias Anteriores a dataOrdemInicial - salvar transações', default: 0 }), required: false, type: Number, example: 7 })
  @ApiQuery({ name: 'consorcio', description: 'Nome do consorcio - salvar transações', required: true, type: String, example: 'Todos / Van / Empresa /Nome Consorcio' })
  @ApiQuery({ name: 'dt_pagamento', description: ApiDescription({ _: 'Data Pagamento', default: 'O dia de hoje' }), required: false, type: String })
  @ApiQuery({ name: 'isConference', description: 'Conferencia - Se o remessa será gerado numa tabela de teste.', required: true, type: Boolean, example: true })
  @ApiQuery({ name: 'isCancelamento', description: 'Cancelamento', required: true, type: Boolean, example: false })
  @ApiQuery({ name: 'isTeste', type: Boolean, required: true, description: 'Define se o CNAB Remessa usará o parâmetro de Teste', example: false })
  @ApiQuery({ name: 'nsaInicial', description: ApiDescription({ default: 'O NSA atual' }), required: false, type: Number })
  @ApiQuery({ name: 'nsaFinal', description: ApiDescription({ default: 'nsaInicial' }), required: false, type: Number })
  @ApiQuery({ name: 'dataCancelamento', description: ApiDescription({ _: 'Data de vencimento da transação a ser cancelada (DetalheA).', 'Required if': 'isCancelamento = true' }), required: false, type: String, example: '2024-07-16' })
  @ApiBearerAuth()
  async getGenerateRemessaJae(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true })) _dataOrdemInicial: any, // Date
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true })) _dataOrdemFinal: any, // Date
    @Query('diasAnterioresOrdem', new ParseNumberPipe({ min: 0, defaultValue: 0 })) diasAnteriores: number,
    @Query('consorcio') consorcio: string,
    @Query('dt_pagamento', new ParseDatePipe({ transform: true, optional: true })) _dataPgto: any, // Date | undefined
    @Query('isConference') isConference: boolean,
    @Query('isCancelamento') isCancelamento: boolean,
    @Query('isTeste') isTeste: boolean,
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

    return await this.cnabService.generateRemessaJae({
      dataOrdemInicial,
      dataOrdemFinal,
      diasAnteriores,
      consorcio,
      dataPgto,
      isConference,
      isCancelamento,
      isTeste,
      nsaInicial,
      nsaFinal,
      dataCancelamento,
    });
  }

  @Get('sendRemessa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta o envio de remessa - que normalmente é feita via cronjob' })
  @ApiQuery({ name: 'headerArquivoIds', type: String, required: false, description: ApiDescription({ _: 'Ids do HeaderArquivo para gerar remessa', example: '1,2,3' }) })
  @ApiQuery({ name: 'headerArquivoStatus', enum: HeaderArquivoStatus, required: false, description: ApiDescription({ _: 'Buscar pos status do HeaderArquivo para gerar remessa' }) })
  @ApiBearerAuth()
  async getSendRemessa(
    @Query('headerArquivoIds', new ParseArrayPipe({ items: Number, separator: ',', optional: true })) headerArquivoIds: number[] | undefined, //
    @Query('headerArquivoStatus', new ParseEnumPipe(HeaderArquivoStatus, { optional: true })) headerArquivoStatus: HeaderArquivoStatus | undefined, //
  ) {
    return await this.cnabService.getSendRemessa({ headerArquivoIds, status: headerArquivoStatus });
  }

  @Get('readRetornoPagamento')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a leitura do retorno de pagamentos (Lançamento e Jaé) - que normalmente é feita via cronjob' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'folder', description: ApiDescription({ _: 'Pasta para ler os retornos', default: '`/retorno`' }), required: false, type: String })
  @ApiQuery({ name: 'maxItems', description: ApiDescription({ _: 'Número máximo de itens para ler', min: 1 }), required: false, type: Number })
  async getReadRetornoPagamento(
    @Query('folder') folder: string | undefined, //
    @Query('maxItems', new ParseNumberPipe({ min: 1, optional: true })) maxItems: number | undefined,
  ) {
    return await this.cnabService.readRetornoPagamento(folder, maxItems);
  }

  @Get('readRetornoExtrato')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a leitura do retorno de extrato - que normalmente é feita via cronjob' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'folder', description: ApiDescription({ _: 'Pasta para ler os retornos', default: '`/retorno`' }), required: false, type: String })
  @ApiQuery({ name: 'maxItems', description: ApiDescription({ _: 'Número máximo de itens para ler', min: 1 }), required: false, type: Number })
  async getReadRetornoExtrato(
    @Query('folder') folder: string | undefined, //
    @Query('maxItems', new ParseNumberPipe({ min: 1, optional: true })) maxItems: number | undefined,
  ) {
    return await this.cnabService.readRetornoExtrato(folder, maxItems);
  }

  @Get('syncTransacaoViewOrdemPgto')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta o sincronismo de TransacaoView com as OrdensPagamento (ItemTransacaoAgrupado) - que normalmente é feia via cronjob' })
  @ApiQuery({ name: 'dataOrdemInicial', type: Date, required: false, description: 'Data da Ordem de Pagamento Inicial' })
  @ApiQuery({ name: 'dataOrdemFinal', type: Date, required: false, description: 'Data da Ordem de Pagamento Final' })
  @ApiQuery({ name: 'nomeFavorecido', type: String, required: false, description: 'Lista de nomes dos favorecidos' })
  @ApiBearerAuth()
  async getSyncTransacaoViewOrdemPgto(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true, optional: true })) dataOrdemInicial: Date | undefined, //
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true, optional: true })) dataOrdemFinal: Date | undefined,
    @Query('nomeFavorecido', new ParseArrayPipe1({ transform: true, optional: true })) nomeFavorecido: string[] | undefined,
  ) {
    const dataOrdem_between = dataOrdemInicial && dataOrdemFinal && ([dataOrdemInicial, dataOrdemFinal] as [Date, Date]);
    return await this.cnabService.syncTransacaoViewOrdemPgto({ dataOrdem_between, nomeFavorecido });
  }

  @Get('updateTransacaoViewBigquery')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Atualiza TransacaoView do Bigquery' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'dataOrdemInicial', type: Date, required: true, description: 'Data da Ordem de Pagamento Inicial' })
  @ApiQuery({ name: 'dataOrdemFinal', type: Date, required: true, description: 'Data da Ordem de Pagamento Final' })
  @ApiQuery({ name: 'consorcio', type: String, required: false, description: ApiDescription({ _: 'Nome do consorcio - salvar transações', default: 'Todos' }), example: 'Todos / Van / Empresa /Nome Consorcio' })
  @ApiQuery({ name: 'idTransacao', type: String, required: false, description: 'Lista de idTransacao para atualizar' })
  async getUpdateTransacaoViewBigquery(
    @Query('dataOrdemInicial', new ParseDatePipe({ transform: true })) dataOrdemInicial: any, //
    @Query('dataOrdemFinal', new ParseDatePipe({ transform: true })) dataOrdemFinal: any,
    @Query('consorcio') consorcio: string | undefined,
    @Query('idTransacao', new ParseArrayPipe1({ optional: true })) idTransacao: string[], //
  ) {
    const _dataOrdemInicial: Date = dataOrdemInicial;
    const _dataOrdemFinal: Date = dataOrdemFinal;
    const _consorcio = consorcio || 'Todos';
    return await this.cnabService.updateTransacaoViewBigquery(_dataOrdemInicial, _dataOrdemFinal, 0, _consorcio, idTransacao);
  }

  @Get('deduplicateTransacaoView')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nRemove duplicatas de TransacaoView' })
  @ApiBearerAuth()
  async getDeduplicateTransacaoView() {
    return await this.cnabService.deduplicateTransacaoView();
  }

  @Get('updateTransacaoViewBigqueryValues')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nAtualiza os valores de TransacaoView existentes a a partir do Bigquery.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'diasAnteriores', type: Number, required: false, description: 'Atualizar apenas os itens até N dias atrás' })
  @ApiQuery({ name: 'idOperadora', type: String, required: false, description: ApiDescription({ _: 'Pesquisar pelo idConsorcio para atualizar', example: '8000123,8000456' }) })
  async getUpdateTransacaoViewBigqueryValues(
    @Query('diasAnteriores', new ParseNumberPipe({ optional: true })) diasAnteriores: number | undefined, //
    @Query('idOperadora', new ParseArrayPipe1({ optional: true })) idOperadora: string[] | undefined, //
  ) {
    return await this.cnabService.updateTransacaoViewBigqueryValues(diasAnteriores, idOperadora);
  }
}
