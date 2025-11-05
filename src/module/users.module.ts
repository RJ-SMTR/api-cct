import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { MailHistoryModule } from 'src/module/mail-history.module';
import { BanksModule } from 'src/module/banks.module';
import { UsersController } from 'src/controller/users.controller';
import { User } from 'src/domain/entity/user.entity';
import { UsersRepository } from 'src/repository/users.repository';
import { UsersService } from 'src/service/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), MailHistoryModule, BanksModule],
  controllers: [UsersController],
  providers: [IsExist, IsNotExist, UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
