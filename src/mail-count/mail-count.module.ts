import { Module } from '@nestjs/common';
import { MailCountService } from './mail-count.service';
import { MailCountController } from './mail-count.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailCount } from './entities/mail-count.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MailCount])],
  providers: [MailCountService],
  controllers: [MailCountController],
  exports: [MailCountService],
})
export class MailCountModule {}
