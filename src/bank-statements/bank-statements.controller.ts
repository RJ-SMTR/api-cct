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
import { BankStatementsService } from './bank-statements.service';
import { BankStatementsGetDto } from './dto/bank-statements-get.dto';
import { BankStatementsInterface } from './interfaces/bank-statements.interface';
import { UsersService } from 'src/users/users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('BankStatements')
@Controller({
  path: 'bank-statements',
  version: '1',
})
export class BankStatementsController {
  constructor(
    private readonly bankStatementsService: BankStatementsService,
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
    @Body() profileDto: BankStatementsGetDto,
  ): Promise<BankStatementsInterface[]> {
    const user = await this.usersService.getOneFromRequest(request);
    return this.bankStatementsService.getFromUser(user, profileDto);
  }
}
