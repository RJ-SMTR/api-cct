import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { InviteStatusNamesEnum } from 'src/domain/enum/mail-history-status.enum';
import { Role } from 'src/security/roles/entities/role.entity';
import { RoleEnum } from 'src/security/roles/roles.enum';
import { FileTypeValidationPipe } from 'src/utils/file-type/pipes/file-type-validation.pipe';
import { infinityPagination } from 'src/utils/infinity-pagination';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { EnumValidationPipe } from 'src/utils/pipes/enum-validation.pipe';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { InfinityPaginationResultType } from '../utils/types/infinity-pagination-result.type';
import { Nullable } from '../utils/types/nullable.type';
import { CreateUserDto } from '../domain/dto/create-user.dto';
import { UpdateUserDto } from '../domain/dto/update-user.dto';
import { IFindUserPaginated } from '../domain/interface/find-user-paginated.interface';
import { IUserUploadResponse } from '../domain/interface/user-upload-response.interface';
import { UsersService } from '../service/users.service';
import { User } from 'src/domain/entity/user.entity';

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
  @ApiQuery({ name: 'page', required: false, description: '_Default_ : 1' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '_Default_ : 500 (max)',
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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
    @Query('anyField') anyField?: string,
    @Query('permitCode') permitCode?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query(
      'inviteStatus',
      new EnumValidationPipe(InviteStatusNamesEnum, 'value'),
    )
    inviteStatusName?: InviteStatusNamesEnum,
  ): Promise<InfinityPaginationResultType<User>> {
    if (limit > 500) {
      limit = 500;
    }
    const pagination: PaginationOptions = { page, limit };
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
    return infinityPagination(
      await this.usersService.findManyWithPagination(pagination, fields),
      pagination,
    );
  }

  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getId(@Param('id') id: string): Promise<Nullable<User>> {
    return this.usersService.findOne({ id: +id });
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
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new FileTypeValidationPipe(['spreadsheet', 'csv']))
  async postUpload(
    @Request() request: IRequest,
    @UploadedFile() file: Express.Multer.File | Express.MulterS3.File,
  ): Promise<IUserUploadResponse> {
    return this.usersService.createFromFile(file, request.user);
  }
}
