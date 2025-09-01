import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { BanksModule } from 'src/banks/banks.module';
import { UsersRepository } from './users.repository';
import { AuxUserDesativado } from './entities/aux_user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuxUserDesativado]), MailHistoryModule, BanksModule],
  controllers: [UsersController],
  providers: [IsExist, IsNotExist, UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
