import { Module } from '@nestjs/common';
import { AuthFacebookService } from './service/auth-facebook.service';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from 'src/auth/auth.module';
import { AuthFacebookController } from './controller/auth-facebook.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthFacebookService],
  exports: [AuthFacebookService],
  controllers: [AuthFacebookController],
})
export class AuthFacebookModule {}
