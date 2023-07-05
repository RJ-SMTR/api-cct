import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationCode } from './entities/validation-code.entity';
import { ValidationCodeService } from './validation-code.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationCode]), UsersModule],
  providers: [ValidationCodeService],
  exports: [ValidationCodeService],
})
export class ValidationCodeModule {}
