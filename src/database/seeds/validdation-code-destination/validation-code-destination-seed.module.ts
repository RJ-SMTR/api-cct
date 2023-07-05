import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationCodeDestinationSeedService } from './validation-code-destination-seed.service';
import { ValidationCodeDestination } from 'src/validation-code/validation-code-destination/entities/validation-code-destination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationCodeDestination])],
  providers: [ValidationCodeDestinationSeedService],
  exports: [ValidationCodeDestinationSeedService],
})
export class CodeDestinationSeedModule {}
