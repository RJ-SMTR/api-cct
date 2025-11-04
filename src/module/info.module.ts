import { Module } from '@nestjs/common';
import { InfoController } from '../controller/info.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Info } from '../domain/entity/info.entity';
import { InfoService } from 'src/service/info.service';

@Module({
  imports: [TypeOrmModule.forFeature([Info])],
  controllers: [InfoController],
  providers: [InfoService],
  exports: [InfoService],
})
export class InfoModule {}
