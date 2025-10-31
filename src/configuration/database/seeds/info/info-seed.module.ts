import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfoSeedService } from './info-seed.service';
import { Info } from 'src/domain/entity/info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Info])],
  providers: [InfoSeedService],
  exports: [InfoSeedService],
})
export class InfoSeedModule {}
