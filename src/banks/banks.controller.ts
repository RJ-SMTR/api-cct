import { Controller, Get } from '@nestjs/common';
import { BanksService } from './banks.service';
import { Bank } from './entities/bank.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Banks')
@Controller({
  path: 'banks',
  version: '1',
})
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  async getAllowedBanks(): Promise<Bank[]> {
    return this.banksService.getAllowedBanks();
  }
}
