import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { InfoService } from './info.service';
import { Info } from './entities/info.entity';
import { NullableType } from 'src/utils/types/nullable.type';

@ApiTags('Info')
@Controller('info')
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Get()
  async getAll(): Promise<NullableType<Info[]>> {
    return this.infoService.find();
  }

  @Get('v:version')
  @ApiParam({ name: 'version', example: '1' }) // Add this line
  getByVersion(
    @Param('version') version: string,
  ): Promise<NullableType<Info[]>> {
    return this.infoService.findByVersion(version);
  }
}
