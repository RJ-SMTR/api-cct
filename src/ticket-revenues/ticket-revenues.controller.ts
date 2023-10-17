import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UsersService } from 'src/users/users.service';
import { TicketRevenuesService } from './ticket-revenues.service';
import { JaeTicketRevenueInterface } from 'src/jae/interfaces/jae-ticket-revenue.interface';
import { MinMaxNumberPipe } from 'src/utils/pipes/min-max-number.pipe';
import { InfinityPaginationResultType } from 'src/utils/types/infinity-pagination-result.type';
import { infinityPagination } from 'src/utils/infinity-pagination';

@ApiTags('TicketRevenues')
@Controller({
  path: 'ticket-revenues',
  version: '1',
})
export class TicketRevenuesController {
  constructor(
    private readonly ticketRevenuesService: TicketRevenuesService,
    private readonly usersService: UsersService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'default: 1 (min)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'default: 500 (max)',
    example: 500,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'hours: 00:00',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'hours: 23:59:59.999',
  })
  @ApiQuery({
    name: 'previousDays',
    required: false,
    description: 'default: 7, minimum: 0',
  })
  async getFromUser(
    @Request() request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('previousDays', new MinMaxNumberPipe({ min: 0 }))
    previousDays?: number | undefined,
  ): Promise<InfinityPaginationResultType<JaeTicketRevenueInterface>> {
    const user = await this.usersService.getOneFromRequest(request);
    return infinityPagination(
      await this.ticketRevenuesService.getDataFromUser(
        user,
        { startDate, endDate, previousDays },
        { limit, page },
      ),
      { limit, page },
    );
  }
}
