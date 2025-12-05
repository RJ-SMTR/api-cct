import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Request, UseGuards } from "@nestjs/common";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamentoAuthorizeDto } from "../domain/dto/aprovacao-pagamento-authorize.dto";
import { AprovacaoPagamentoService } from "../service/aprovacao-pagamento.service";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Nullable } from "src/utils/types/nullable.type";
import { IRequest } from "src/utils/interfaces/request.interface";
import { RolesGuard } from "src/roles/roles.guard";
import { Roles } from "src/roles/roles.decorator";
import { RoleEnum } from "src/roles/roles.enum";

@ApiTags('AprovacaoPagamento')
@Controller({
    path: 'aprovacaoPagamento',
    version: '1',
})
export class AprovacaoPagamentoController {
    constructor(private readonly aprovacaoPagamentoService: AprovacaoPagamentoService) { }


    @Get('/')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))     
    @ApiBearerAuth()    
    async getAll(       
    ): Promise<AprovacaoPagamentoDTO[]> {       
    return await this.aprovacaoPagamentoService.findAll();
    }

    @Get('/:id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async getById(
    @Param('id') id: number,
    ): Promise<Nullable<AprovacaoPagamentoDTO>> {
       return await this.aprovacaoPagamentoService.findById(id);
    }
 

    @Post('/')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiBody({ type: AprovacaoPagamentoDTO })
    async save(
        @Body() aprovacaoPagamentoDTO: AprovacaoPagamentoDTO,
    ): Promise<AprovacaoPagamentoDTO> {
        return await this.aprovacaoPagamentoService.save(aprovacaoPagamentoDTO);
    }

    @Put('/:id')
    @HttpCode(HttpStatus.ACCEPTED)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiBody({ type: AprovacaoPagamentoDTO })
    async update(
        @Request() req: IRequest, //
        @Body() aprovacaoPagamentoDTO: AprovacaoPagamentoDTO,
        @Param('id') id: number,
    ): Promise<AprovacaoPagamentoDTO> {
        aprovacaoPagamentoDTO.id = id;
        return await this.aprovacaoPagamentoService.save(aprovacaoPagamentoDTO);
    }

    @Put('/aprovar/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(RoleEnum.master)
    @ApiBearerAuth()
    @ApiBody({ type: AprovacaoPagamentoAuthorizeDto })
    async put(
        @Request() req: IRequest, 
        @Body() aprovacaoPagamentoAuthorizeDto: AprovacaoPagamentoAuthorizeDto,
        @Param('id') id: number,
    ): Promise<AprovacaoPagamentoDTO> {
        const userId = req.user.id;
        return await this.aprovacaoPagamentoService.approvePayment(
            id, 
            userId, 
            aprovacaoPagamentoAuthorizeDto.password,
            aprovacaoPagamentoAuthorizeDto.valorAprovado
        );
    }

    @Delete('/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()    
    async delete(
         @Param('id') id: number,
    ){
       return await this.aprovacaoPagamentoService.delete(id);
    }

}