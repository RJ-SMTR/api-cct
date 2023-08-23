import {
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
import { ValidatorGtfsDataInterface } from './interface/validator-gtfs-data.interface';
import { UsersService } from 'src/users/users.service';
import { ValidatorGtfsDataService } from './validator-gtfs-data.service';

@ApiTags('ValidatorGtfsData')
@Controller({
  path: 'validator-gtfs-data',
  version: '1',
})
export class ValidatorGtfsDataController {
  constructor(
    private readonly validatorGtfsDataService: ValidatorGtfsDataService,
    private readonly usersService: UsersService,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async getBankStatementsFromUser(
    @Request() request,
  ): Promise<ValidatorGtfsDataInterface[]> {
    const user = await this.usersService.getOneFromRequest(request);
    return this.validatorGtfsDataService.getDataFromUser(user);
  }
}
