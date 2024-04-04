import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from 'src/config/app.config';
import { Cnab104AmbienteCliente } from '../enums/104/cnab-104-ambiente-cliente.enum';

@Injectable()
export class Cnab104Service {
  private logger: Logger = new Logger('Cnab104Service', {
    timestamp: true,
  });

  constructor(private readonly configService: ConfigService) {}

  /**
   * Cnab Caixa Cliente environment is Test if NODE_ENV is not 'production'.
   */
  public isCnab104Test(): boolean {
    const nodeEnv = () =>
      this.configService.getOrThrow<Environment>('app.nodeEnv');
    return ![Environment.Production].includes(nodeEnv());
  }

  public getCnab104ClienteCaixa(): Cnab104AmbienteCliente {
    return Cnab104AmbienteCliente.Producao;
  }
}
