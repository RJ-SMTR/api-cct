import { Controller, Get, HttpCode, HttpStatus, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { RoleEnum } from 'src/roles/roles.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { AgentesDashboardQueryDto } from './dtos/agentes-dashboard-query.dto';
import { AgentesService } from './agentes.service';

@ApiTags('Agentes')
@ApiBearerAuth()
@Roles(RoleEnum.master, RoleEnum.admin, RoleEnum.agents)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'agentes',
  version: '1',
})
export class AgentesController {
  constructor(private readonly agentesService: AgentesService) {}

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getAgentUsers() {
    return this.agentesService.getAgentUsers();
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboard(
    @Query() query: AgentesDashboardQueryDto,
    @Request() request: IRequest,
  ) {
    return this.agentesService.getDashboard(query, request);
  }
}
