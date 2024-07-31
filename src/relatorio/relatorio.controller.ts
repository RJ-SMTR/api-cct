import { Controller, Get, HttpCode, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OcorrenciaUserEnum } from 'src/cnab/enums/ocorrencia-user.enum';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { Enum } from 'src/utils/enum';
import { ParseBooleanPipe } from 'src/utils/pipes/parse-boolean.pipe';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ParseNumberPipe } from 'src/utils/pipes/parse-number.pipe';
import { RelatorioService } from './relatorio.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio',
  version: '1',
})
export class RelatorioController {
  constructor(private relatorioService: RelatorioService) {}

  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: false, type: String, example: '2024-07-15' })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: false, type: String, example: '2024-07-16' })
  @ApiQuery({ name: 'favorecidoNome', description: 'Pesquisa o nome parcial dos favorecidos, sem distinção de acento ou maiúsculas.', required: false, type: String, example: 'internorte,intersul,jose carlos' })
  @ApiQuery({ name: 'favorecidoCpfCnpj', description: 'Pesquisa o cpf/cnpj dos favorecidos', required: false, type: String, example: '11111,22222,33333' })
  @ApiQuery({ name: 'consorcioNome', description: ApiDescription({ _: 'Pesquisa o nome parcial dos consórcios, sem distinção de acento ou maiúsculas.', 'STPC/STPL': 'Agrupa todos os vanzeiros sob o consórcio' }), required: false, type: String, example: 'Santa Cruz,STPL,Internorte,STPC,MobiRio,Transcarioca,Intersul,VLT' })
  @ApiQuery({ name: 'valorRealEfetivadoMin', description: 'Somatório do valor real pago ao favorecido.', required: false, type: Number, example: 12.0 })
  @ApiQuery({ name: 'valorRealEfetivadoMax', description: 'Somatório do valor real pago ao favorecido.', required: false, type: Number, example: 12.99 })
  @ApiQuery({ name: 'valorMin', description: 'Somatório do valor bruto.', required: false, type: Number, example: 12.0 })
  @ApiQuery({ name: 'valorMax', description: 'Somatório do valor bruto.', required: false, type: Number, example: 12.99 })
  @ApiQuery({ name: 'ocorrenciaCodigo', description: 'Código de ocorrência.', required: false, type: String, example: Enum.getKeys(OcorrenciaUserEnum) })
  @ApiQuery({ name: 'erro', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento apresentou erro.', default: false }) })
  @ApiQuery({ name: 'pago', required: false, type: Boolean, description: ApiDescription({ _: 'Se o pagamento foi pago com sucesso.', default: false }) })
  @ApiQuery({ name: 'decimais', required: false, type: Number, description: ApiDescription({ _: 'Número de casas decimais exibidos e a serem pesquisados.', default: 2, min: 0, max: 4 }) })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('consolidado')
  async getConsolidado(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true, optional: true }))
    dataInicio: Date | undefined,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true, optional: true }))
    dataFim: Date | undefined,
    @Query('favorecidoNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    favorecidoNome: string[],
    @Query('favorecidoCpfCnpj', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    favorecidoCpfCnpj: string[],
    @Query('consorcioNome', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    consorcioNome: string[],
    @Query('valorRealEfetivadoMin', new ParseNumberPipe({ optional: true }))
    valorRealEfetivadoMin: number | undefined,
    @Query('valorRealEfetivadoMax', new ParseNumberPipe({ optional: true }))
    valorRealEfetivadoMax: number | undefined,
    @Query('valorMin', new ParseNumberPipe({ optional: true }))
    valorMin: number | undefined,
    @Query('valorMax', new ParseNumberPipe({ optional: true }))
    valorMax: number | undefined,
    @Query('ocorrenciaCodigo', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    ocorrenciaCodigo: string[],
    @Query('erro', new ParseBooleanPipe({ optional: true }))
    erro: boolean | undefined,
    @Query('pago', new ParseBooleanPipe({ optional: true }))
    pago: boolean | undefined,
    @Query('decimais', new ParseNumberPipe({ defaultValue: 2, min: 0, max: 4 }))
    decimais: number | undefined,
  ) {
    return await this.relatorioService.findConsolidado({
      dataInicio,
      dataFim,
      favorecidoNome,
      favorecidoCpfCnpj,
      consorcioNome,
      valorRealEfetivadoMin,
      valorRealEfetivadoMax,
      valorMin,
      valorMax,
      ocorrenciaCodigo,
      decimais,
      erro,
      pago,
    });
  }
}
