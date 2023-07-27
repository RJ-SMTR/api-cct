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
import { TripsIncomeGetDto } from './dto/trips-income-get.dto';
import { TripsIncomeInterface } from './interfaces/trips-income.interface';
import { TripsIncomeService } from './trips-income.service';
import { UsersService } from 'src/users/users.service';

@ApiTags('TripsIncome')
@Controller({
  path: 'trips-income',
  version: '1',
})
export class TripsIncomeController {
  constructor(
    private readonly bankStatementsService: TripsIncomeService,
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
    @Body() profileDto: TripsIncomeGetDto,
  ): Promise<TripsIncomeInterface[]> {
    const user = await this.usersService.getOneFromRequest(request);
    return this.bankStatementsService.getFromUser(user, profileDto);
  }
}
