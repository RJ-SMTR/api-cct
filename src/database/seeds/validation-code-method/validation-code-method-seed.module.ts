import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationCodeMethod } from 'src/validation-code/validation-code-method/entities/validation-code-method.entity';
import { ValidationCodeMethodSeedService } from './validation-code-method-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationCodeMethod])],
  providers: [ValidationCodeMethodSeedService],
  exports: [ValidationCodeMethodSeedService],
})
export class ValidationCodeMethodSeedModule {}
