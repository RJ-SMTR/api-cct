import { Module } from '@nestjs/common';
import { MailCountService } from '../service/mail-count.service';
import { MailCountController } from '../controller/mail-count.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailCount } from '../domain/entity/mail-count.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MailCount])],
  providers: [MailCountService],
  controllers: [MailCountController],
  exports: [MailCountService],
})
export class MailCountModule {}
