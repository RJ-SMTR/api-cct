import {
  Body,
  HttpCode,
  HttpStatus,
  Module,
  Post,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { TripsIncomeService } from './trips-income.service';
import { TripsIncomeController } from './trips-income.controller';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TripsIncomeGetDto } from './dto/trips-income-get.dto';
import { TripsIncomeInterface } from './interfaces/trips-income.interface';

@Module({
  providers: [TripsIncomeService],
  controllers: [TripsIncomeController],
  imports: [UsersModule],
})
export class TripsIncomeModule {
  constructor(
    private readonly tripsIncomeService: TripsIncomeService,
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
    return this.tripsIncomeService.getFromUser(user, profileDto);
  }
}
