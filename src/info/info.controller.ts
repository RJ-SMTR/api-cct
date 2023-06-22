import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InfoService } from './info.service';
import { Info } from './entities/info.entity';

@ApiTags('Info')
@Controller({
  path: 'info',
  version: '1',
})
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Get()
  async getAll(): Promise<Info[]> {
    return this.infoService.getAll();
  }
}
