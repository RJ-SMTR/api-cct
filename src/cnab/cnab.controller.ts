import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDto } from './service/dto/extrato.dto';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { PagadorContaEnum } from './enums/pagamento/pagador.enum';
import { CnabService } from './cnab.service';

@ApiTags('Cnab')
@Controller({
  path: 'cnab',
  version: '1',
})
export class CnabController {
   
  constructor(
    private readonly clienteFavorecidoService: ClienteFavorecidoService,
    private readonly extratoHeaderArquivoService: ExtratoHeaderArquivoService,
    private readonly arquivoPublicacaoService: ArquivoPublicacaoService,
    private readonly cnabService: CnabService) {}

  @Get('clientes-favorecidos')
  getClienteFavorecido(): Promise<ClienteFavorecido[]> {
    return this.clienteFavorecidoService.getAll();
  }

  @ApiQuery({name: 'conta',required: true,type: String})
  @ApiQuery({name: 'dt_inicio',required: true,type: String,example: '2024-01-01'})
  @ApiQuery({name: 'dt_fim', required: true,type: String,example: '2024-12-25'})
  @ApiQuery({name: 'tipo',required: false,type: String,example: 'cett'})
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master,RoleEnum.admin_finan,RoleEnum.lancador_financeiro,RoleEnum.aprovador_financeiro)
  @Get('extratoLancamento')
  async getLancamentoExtrato(
    @Query('conta') conta: string,@Query('dt_inicio', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/))
    dt_inicio: string, @Query('dt_fim', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/)) dt_fim: string,@Query('tipo') tipoLancamento?: string
  ): Promise<ExtratoDto[]> {
    return await this.extratoHeaderArquivoService.getExtrato(conta,dt_inicio,dt_fim,tipoLancamento);
  }

  @ApiQuery({name: 'dt_inicio', description: 'dataOrdem',required: true, type: String,  example: '2024-01-01'})
  @ApiQuery({name: 'dt_fim', description: 'dataOrdem',required: true, type: String, example: '2024-12-25'})
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('arquivoPublicacao')
  async getArquivoPublicacao(@Query('dt_inicio', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/))
    dt_inicio: string, @Query('dt_fim', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/)) dt_fim: string  ) {
    return await this.arquivoPublicacaoService.findManyByDate(
      new Date(dt_inicio + ' '),
      new Date(dt_fim + ' ')
    );
  }


  @ApiQuery({name: 'dataOrdemInicial',description: 'Data da Ordem de Pagamento Inicial',
    required: false, type: String, example: '2024-07-15'})     
  @ApiQuery({name: 'dataOrdemFinal',description: 'Data da Ordem de Pagamento Final',
      required: false, type: String, example: '2024-07-16'})     
  @ApiQuery({name: 'diasAnterioresSexta',description: 'Qtde dias Anteriores a sexta',
     required: false, type: Number, example: 7}) 
  @ApiQuery({name: 'consorcio',description: 'Nome Consorcio',required: false, type: String, example: 'Todos / Van / Empresa /Nome Consorcio'})
  @ApiQuery({name: 'dt_pagamento',description: 'Data Pagamento', required: false, type: String})
  @ApiQuery({name: 'isConference',description: 'Conferencia',required: false, type: Boolean, example: 'true or false'})
  @ApiQuery({name: 'isCancelamento',description: 'Cancelamento',required: false, type: Boolean, example: 'true or false'})
  @ApiQuery({name: 'nsaInicial',required: false, type: String })
  @ApiQuery({name: 'nsaFinal',required: false, type: String})
  @ApiQuery({name: 'dataCancelamento',required: false, type: String})
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('generateRemessa')
  async generateRemessa(
    @Query('dataOrdemInicial') dataOrdemInicial: string | undefined,
    @Query('dataOrdemFinal') dataOrdemFinal: string | undefined,
    @Query('diasAnterioresSexta') diasAnteriores = 0,
    @Query('consorcio') consorcio='Todos',
    @Query('dt_pagamento', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/)) dt_pagamento: string | undefined,
    @Query('isConference') isConference: boolean,
    @Query('isCancelamento') isCancelamento: boolean,
    @Query('nsaInicial') nsaInicial: number,
    @Query('nsaFinal') nsaFinal: number,
    @Query('dataCancelamento', new ParseDatePipe(/^\d{4}-\d{2}-\d{2}$/)) dataCancelamento: string) {
    let listCnab;
    if(dt_pagamento !==null && dt_pagamento !==undefined){
      await this.cnabService.saveTransacoesJae(dataOrdemInicial,dataOrdemFinal,diasAnteriores,consorcio);
      listCnab = await this.cnabService.generateRemessa(PagadorContaEnum.ContaBilhetagem,
        new Date(dt_pagamento),isConference,isCancelamento,nsaInicial,nsaFinal,new Date(dataCancelamento)); 
    }else{
      await this.cnabService.saveTransacoesJae(dataOrdemInicial,dataOrdemFinal,diasAnteriores,consorcio);
      listCnab = await this.cnabService.generateRemessa(PagadorContaEnum.ContaBilhetagem,
        undefined,isConference,isCancelamento,nsaInicial,nsaFinal,new Date(dataCancelamento)); 
    }      
    await this.cnabService.sendRemessa(listCnab); 
    return listCnab; 
  }
 
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('updateRetorno')
  async updateRetorno(){
    return await this.cnabService.updateRetorno();   
  }
}