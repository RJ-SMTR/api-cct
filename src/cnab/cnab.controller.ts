import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { CustomLogger } from 'src/utils/custom-logger';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { ParseEnumPipe } from 'src/utils/pipes/parse-enum.pipe';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { GetClienteFavorecidoConsorcioEnum } from './enums/get-cliente-favorecido-consorcio.enum';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDto } from './service/dto/extrato.dto';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ParseArrayPipe } from 'src/utils/pipes/parse-array.pipe';
import { ConcessionariaNomeEnum } from './enums/concessionaria-nome.enum';

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
  ) {}

  @Get('clientes-favorecidos')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master, RoleEnum.admin, RoleEnum.admin_finan, RoleEnum.lancador_financeiro, RoleEnum.aprovador_financeiro)
  @ApiBearerAuth()
  @ApiQuery({ name: 'nome', description: 'Pesquisa por parte do nome, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'nomeNot', description: 'Ignora nomes com parte do nome, sem distinção de acento ou maiúsculas.', required: false, type: String })
  @ApiQuery({ name: 'consorcio', description: 'Nome do consorcio', required: false, enum: GetClienteFavorecidoConsorcioEnum })
  @ApiQuery({ name: 'limit', description: ApiDescription({ _: 'Itens exibidos por página', min: 1 }), required: false, type: Number })
  @ApiQuery({ name: 'page', description: ApiDescription({ _: 'Itens exibidos por página', min: 1 }), required: false, type: Number })
  getClienteFavorecido(
    @Query('nome', new ParseArrayPipe({ optional: true })) nome: string[], //
    @Query('nomeNot', new ParseArrayPipe({ optional: true, transformOptional: true })) nomeNot: string[], //
    @Query('consorcio', new ParseEnumPipe(GetClienteFavorecidoConsorcioEnum, { optional: true })) consorcio: GetClienteFavorecidoConsorcioEnum | undefined,
    @Query('limit', new ParseNumberPipe({ min: 0, optional: true })) limit: number | undefined,
    @Query('page', new ParseNumberPipe({ min: 1, optional: true })) page: number | undefined,
  ): Promise<ClienteFavorecido[]> {
    if (consorcio === GetClienteFavorecidoConsorcioEnum.Empresa) {
      nomeNot.push(ConcessionariaNomeEnum.VLT);
    }
    return this.clienteFavorecidoService.getFindBy({ nome: { in: nome, not: nomeNot }, limit, page, consorcio });
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
}
