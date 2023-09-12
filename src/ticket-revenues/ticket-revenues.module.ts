import { Module } from '@nestjs/common';
import { TicketRevenuesService } from './ticket-revenues.service';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { JaeModule } from 'src/jae/jae.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [JaeModule, UsersModule],
  providers: [TicketRevenuesService],
  controllers: [TicketRevenuesController],
})
export class TicketRevenuesModule {}
