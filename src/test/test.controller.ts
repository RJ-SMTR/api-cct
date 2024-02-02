// import { Controller, Get, Param } from '@nestjs/common';
// import { ApiTags, ApiParam } from '@nestjs/swagger';
// import { NullableType } from 'src/utils/types/nullable.type';
// import { CronJobsService } from '../cron-jobs/cron-jobs.service';

// @ApiTags('Test')
// @Controller('test')
// export class TestController {
//   constructor(private readonly cronJobsService: CronJobsService) { }

//   @Get()
//   async getAll(): Promise<NullableType<Info[]>> {
//     return this.infoService.find();
//   }

//   @Get('v:version')
//   @ApiParam({ name: 'version', example: '1' })
//   getByVersion(
//     @Param('version') version: string,
//   ): Promise<NullableType<Info[]>> {
//     return this.infoService.findByVersion(version);
//   }
// }
