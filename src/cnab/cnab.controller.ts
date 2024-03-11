import { Controller, Get } from '@nestjs/common';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ApiTags } from '@nestjs/swagger';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';


@ApiTags('cnab')
@Controller('cnab')
export class CnabController {
  constructor(private readonly clienteFavorecidoService: ClienteFavorecidoService) {}
  @Get('clientes-favorecidos')
  getClienteFavorecido(): Promise<ClienteFavorecido[]> {
    return this.clienteFavorecidoService.getAll();
  }
    
}