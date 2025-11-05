import { Module } from '@nestjs/common';
import { HomeService } from '../service/home.service';
import { HomeController } from '../controller/home.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
