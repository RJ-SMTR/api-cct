import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AgendamentoPagamentoDTO } from "../domain/dto/agendamento-pagamento.dto";
import { AgendamentoPagamentoService } from "../service/agendamento-pagamento.service";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Nullable } from "src/utils/types/nullable.type";

@ApiTags('AgendamentoPagamento')
@Controller({
    path: 'agendamentoPagamento',
    version: '1',
})
export class AgendamentoPagamentoController {
    constructor(private readonly agendamentoPagamentoService: AgendamentoPagamentoService) { }


    @Get('/')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))     
    @ApiBearerAuth()    
    async getAll(       
    ): Promise<AgendamentoPagamentoDTO[]> {       
    return await this.agendamentoPagamentoService.findAll();
    }

    @Get('/:id')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async getById(
    @Param('id') id: number,
    ): Promise<Nullable<AgendamentoPagamentoDTO>> {
       return await this.agendamentoPagamentoService.findById(id);
    }
 

    @Post('/')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiBody({ type: AgendamentoPagamentoDTO })
    async save(
        @Body() agendamentoPagamentoDTO: AgendamentoPagamentoDTO,
    ): Promise<AgendamentoPagamentoDTO> {
        return await this.agendamentoPagamentoService.save(agendamentoPagamentoDTO);
    }

    @Put('/:id')
    @HttpCode(HttpStatus.ACCEPTED)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiBody({ type: AgendamentoPagamentoDTO })
    async update(
        @Body() agendamentoPagamentoDTO: AgendamentoPagamentoDTO,
        @Param('id') id: number
    ): Promise<AgendamentoPagamentoDTO> {
        agendamentoPagamentoDTO.id = id;
        return await this.agendamentoPagamentoService.save(agendamentoPagamentoDTO);
    }

    @Delete('/:id')
    @HttpCode(HttpStatus.NOT_FOUND)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()    
    async delete(
         @Param('id') id: number,
    ){
        await this.agendamentoPagamentoService.delete(id);
    }

}