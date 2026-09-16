import { Controller, Get, HttpCode, HttpException, HttpStatus, ParseArrayPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab/relatorio',
  version: '1',
})
export class RelatorioController {
  constructor(
     private relatorioNovoRemessaService: RelatorioNovoRemessaService,
  ) { }
  
  @ApiQuery({ name: 'dataInicio', description: 'Data da Ordem de Pagamento Inicial', required: true, type: String })
  @ApiQuery({ name: 'dataFim', description: 'Data da Ordem de Pagamento Final', required: true, type: String })
  @ApiQuery({ name: 'tipo', description: 'Debito ou Credito', required: false, type: String })
  @ApiQuery({ name: 'operacao', description: 'Tipos de Operação', required: false, type: String }) 
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('extrato')
  async getExtrato(
    @Query('dataInicio', new ParseDatePipe({ dateOnly: true }))
    dataInicio: Date,
    @Query('dataFim', new ParseDatePipe({ dateOnly: true }))
    dataFim: Date,
    @Query('tipo') tipo: string,
    @Query('operacao') operacao: string,
    @Query('conta') conta: string
  ) {
    try {
      const result = await this.relatorioNovoRemessaService.findExtrato ({
        dataInicio, dataFim, tipo, operacao, conta
      });
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }
}