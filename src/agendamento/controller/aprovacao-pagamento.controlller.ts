import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamentoService } from "../service/aprovacao-pagamento.service";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Nullable } from "src/utils/types/nullable.type";

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
        @Body() aprovacaoPagamentoDTO: AprovacaoPagamentoDTO,
        @Param('id') id: number
    ): Promise<AprovacaoPagamentoDTO> {
        aprovacaoPagamentoDTO.id = id;
        return await this.aprovacaoPagamentoService.save(aprovacaoPagamentoDTO);
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