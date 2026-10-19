import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationApiParams } from 'src/utils/api-param/pagination.api-param';
import { PaginationQueryParams } from 'src/utils/query-param/pagination.query-param';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';
import { FileTypeValidationPipe } from 'src/utils/file-type/pipes/file-type-validation.pipe';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { OrdemPagamentoService } from '../service/ordem-pagamento.service';

@ApiTags('OrdemPagamentoGuardador')
@Controller({
  path: 'ordem-pagamento-guardador',
  version: '1',
})
export class OrdemPagamentoGuardadorController {
  constructor(private readonly ordemPagamentoService: OrdemPagamentoService) {}

  @Get()
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @ApiQuery(PaginationApiParams.page)
  @ApiQuery(PaginationApiParams.limit)
  @ApiQuery({ name: 'dataOrdemInicio', required: false, type: String })
  @ApiQuery({ name: 'dataOrdemFim', required: false, type: String })
  @ApiQuery({ name: 'cpfCnpj', required: false, type: String })
  @ApiQuery({ name: 'nome', required: false, type: String })
  @HttpCode(HttpStatus.OK)
  async getPaginado(
    @Query(...PaginationQueryParams.page) page: number,
    @Query(...PaginationQueryParams.limit) limit: number,
    // Tipado como `any` (não `Date`) propositalmente: com o ValidationPipe
    // global (`transform: true`), o Nest converteria o parâmetro para Date
    // ANTES do ParseDatePipe rodar, e um valor ausente viraria "Invalid Date"
    // em vez de undefined, quebrando a checagem `optional`.
    @Query('dataOrdemInicio', new ParseDatePipe({ dateOnly: true, optional: true, transform: true })) dataOrdemInicio?: any,
    @Query('dataOrdemFim', new ParseDatePipe({ dateOnly: true, optional: true, transform: true })) dataOrdemFim?: any,
    @Query('cpfCnpj') cpfCnpj?: string,
    @Query('nome') nome?: string,
  ) {
    return this.ordemPagamentoService.findGuardadorListPaginated(page, limit, {
      dataOrdemInicio,
      dataOrdemFim,
      cpfCnpj,
      nome,
    });
  }

  @Post('import')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new FileTypeValidationPipe(['spreadsheet', 'csv']))
  @HttpCode(HttpStatus.OK)
  async importSpreadsheet(@UploadedFile() file: Express.Multer.File) {
    return this.ordemPagamentoService.importGuardadorSpreadsheet(file);
  }
}
