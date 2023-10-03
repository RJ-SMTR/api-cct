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
import { UsersService } from 'src/users/users.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CoreBankStatementsInterface } from 'src/core-bank/interfaces/core-bank-statements.interface';

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
  async getBankStatementsFromUser(
    @Request() request,
    @Body() profileDto: BankStatementsGetDto,
  ): Promise<CoreBankStatementsInterface[]> {
    const user = await this.usersService.getOneFromRequest(request);
    return this.bankStatementsService.getBankStatementsFromUser(
      user,
      profileDto,
    );
  }
}
