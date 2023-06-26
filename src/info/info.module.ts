import { Module } from '@nestjs/common';
import { InfoController } from './info.controller';
import { InfoService } from './info.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Info } from './entities/info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Info])],
  controllers: [InfoController],
  providers: [InfoService],
})
export class InfoModule {}
