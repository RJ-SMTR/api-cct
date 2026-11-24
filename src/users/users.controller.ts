import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  SerializeOptions,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InviteStatusNamesEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { FileTypeValidationPipe } from 'src/utils/file-type/pipes/file-type-validation.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { EnumValidationPipe } from 'src/utils/pipes/enum-validation.pipe';
import {
  InfinityPaginationWithTotalResultType,
  infinityPaginationWithTotal,
  parseOptionalPagination,
} from 'src/utils/optional-pagination';
import { Nullable } from '../utils/types/nullable.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { IUserUploadResponse } from './interfaces/user-upload-response.interface';
import { UsersService } from './users.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@ApiTags('Users')
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @SerializeOptions({
    groups: ['admin'],
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  post(@Body() createProfileDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createProfileDto);
  }

  @SerializeOptions({
    groups: ['admin'],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'page',
    required: false,
    description:
      'Without page and limit the whole filtered list is returned. _Default_ when limit is given: 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Without page and limit the whole filtered list is returned. _Default_ when page is given: 500 (max)',
  })
  @ApiQuery({
    name: 'anyField',
    required: false,
    description:
      'Filter user, with OR operator, by fullName, firstName, lastName, permitCode, email or aux_inviteStatus',
  })
  @ApiQuery({
    name: 'permitCode',
    required: false,
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'filter user by fullName, firstName or lastName',
  })
  @ApiQuery({
    name: 'email',
    required: false,
  })
  @ApiQuery({
    name: 'inviteStatus',
    required: false,
    enum: InviteStatusNamesEnum,
  })
  async get(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('anyField') anyField?: string,
    @Query('permitCode') permitCode?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query(
      'inviteStatus',
      new EnumValidationPipe(InviteStatusNamesEnum, 'value'),
    )
    inviteStatusName?: InviteStatusNamesEnum,
  ): Promise<InfinityPaginationWithTotalResultType<User>> {
    // No page/limit = whole list: the admin home and the report filters still expect it (#1199).
    const pagination = parseOptionalPagination(page, limit);
    const fields: IFindUserPaginated = {
      _anyField: {
        value: anyField,
        fields: ['permitCode', 'name', 'email', 'inviteStatus'],
      },
      permitCode,
      name,
      email,
      inviteStatusName,
      role: new Role(RoleEnum.user),
    };
    const { users, total } = await this.usersService.findManyWithPagination(
      pagination,
      fields,
    );
    return infinityPaginationWithTotal(users, total, pagination);
  }

  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getId(@Param('id') id: string): Promise<Nullable<User>> {
    return this.usersService.findOneWithAssociacoes(+id);
  }

  /** Códigos de permissão antigos do usuário (guardados quando o código foi alterado). */
  @Get(':id/permit-code-history')
  @HttpCode(HttpStatus.OK)
  async getPermitCodeHistory(@Param('id') id: string) {
    const historico = await this.usersService.findPermitCodeHistory(+id);
    return historico.map((h) => ({ id: h.id, permitCode: h.permitCode, createdAt: h.createdAt }));
  }

  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  patchId(
    @Request() request: IRequest,
    @Param('id') id: number,
    @Body() updateProfileDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(
      id,
      updateProfileDto,
      'UsersController.patchId()',
      request.user,
    );
  }

  @SerializeOptions({
    groups: ['admin'],
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Allowed files: spreadsheet, csv',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  // busboy/multer's limits.fileSize rejects a file of exactly the configured size (it flags
  // "truncated" at the Nth byte without waiting to see if more data follows), so "+ 1" here
  // makes a real 10 MB file (10 * 1024 * 1024 bytes) succeed, matching the stated 10 MB limit.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 + 1 } }))
  @UsePipes(new FileTypeValidationPipe(['spreadsheet', 'csv']))
  async postUpload(
    @Request() request: IRequest,
    @UploadedFile() file: Express.Multer.File | Express.MulterS3.File,
  ): Promise<IUserUploadResponse> {
    return this.usersService.createFromFile(file, request.user);
  }
}
