import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from 'src/configuration/app.config';

@Injectable()
export class TestEnvironmentsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    const nodeEnv = () =>
      this.configService.getOrThrow<Environment>('app.nodeEnv');
    return [Environment.Test, Environment.Local].includes(nodeEnv());
  }
}
