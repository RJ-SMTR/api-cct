import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketRevenuesGetDto } from './dto/ticket-revenues-get.dto';
import { UsersService } from 'src/users/users.service';
import { TicketRevenuesService } from './ticket-revenues.service';
import { TicketRevenuesInterface } from './interface/ticket-revenue.interface';

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
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async getFromUser(
    @Request() request,
    @Body() filterDto: TicketRevenuesGetDto,
  ): Promise<TicketRevenuesInterface[]> {
    const user = await this.usersService.getOneFromRequest(request);
    return await this.ticketRevenuesService.getDataFromUser(user, filterDto);
  }
}
