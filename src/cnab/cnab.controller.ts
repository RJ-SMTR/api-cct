import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { Controller, Get, HttpCode, HttpStatus, Query} from '@nestjs/common';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ApiTags } from '@nestjs/swagger';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ExtratoDto } from './service/dto/extrato.dto';


@ApiTags('cnab')
@Controller('cnab')
export class CnabController {
  constructor(private readonly clienteFavorecidoService: ClienteFavorecidoService,
    private readonly extratoHeaderArquivoService:ExtratoHeaderArquivoService) { }

  @Get('clientes-favorecidos')
  getClienteFavorecido(): Promise<ClienteFavorecido[]> {
    return this.clienteFavorecidoService.getAll();
  }


  @HttpCode(HttpStatus.OK)
  @Get('extratoLancamento')
  async getLancamentoExtrato(
    @Query('conta') conta: string,
    @Query('dt_inicio') dt_inicio: number,
    @Query('dt_fim') dt_fim: number,
    @Query('tipo') tipoLancamento: string
    
  ): Promise<ExtratoDto[]> {
    
    return await this.extratoHeaderArquivoService.getExtrato(conta,dt_inicio,dt_fim,tipoLancamento);
  }
}