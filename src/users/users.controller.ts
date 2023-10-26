import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  SerializeOptions,
  UseInterceptors,
  UploadedFile,
  UsePipes,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/roles/roles.guard';
import { infinityPagination } from 'src/utils/infinity-pagination';
import { User } from './entities/user.entity';
import { InfinityPaginationResultType } from '../utils/types/infinity-pagination-result.type';
import { NullableType } from '../utils/types/nullable.type';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileTypeValidationPipe } from 'src/utils/file-type/pipes/file-type-validation.pipe';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { InviteStatusNamesEnum } from 'src/invite-statuses/invite-status.enum';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { EnumValidationPipe } from 'src/utils/pipes/enum-validation.pipe';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
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
  create(@Body() createProfileDto: CreateUserDto): Promise<User> {
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
  async findAll(
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
    const pagination: IPaginationOptions = { page, limit };
    const fields: IFindUserPaginated = {
      _anyField: {
        value: anyField,
        fields: ['permitCode', 'name', 'email', 'inviteStatus'],
      },
      permitCode,
      name,
      email,
      inviteStatusName,
    };
    return infinityPagination(
      await this.usersService.findManyWithPagination(pagination, fields),
      pagination,
    );
  }

  @SerializeOptions({
    groups: ['admin'],
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string): Promise<NullableType<User>> {
    return this.usersService.findOne({ id: +id });
  }

  @SerializeOptions({
    groups: ['admin'],
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: number,
    @Body() updateProfileDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateProfileDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number): Promise<void> {
    return this.usersService.softDelete(id);
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
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | Express.MulterS3.File,
  ) {
    return this.usersService.createFromFile(file);
  }
}
