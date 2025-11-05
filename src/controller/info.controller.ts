import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { Info } from '../domain/entity/info.entity';
import { Nullable } from 'src/utils/types/nullable.type';
import { InfoService } from 'src/service/info.service';

@ApiTags('Info')
@Controller('info')
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Get()
  async getAll(): Promise<Nullable<Info[]>> {
    return this.infoService.find();
  }

  @Get('v:version')
  @ApiParam({ name: 'version', example: '1' })
  getByVersion(@Param('version') version: string): Promise<Nullable<Info[]>> {
    return this.infoService.findByVersion(version);
  }
}
