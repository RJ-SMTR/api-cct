import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from 'src/auth/auth.module';
import { AuthAppleController } from './controller/auth-apple.controller';
import { AuthAppleService } from './service/auth-apple.service';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthAppleService],
  exports: [AuthAppleService],
  controllers: [AuthAppleController],
})
export class AuthAppleModule {}
