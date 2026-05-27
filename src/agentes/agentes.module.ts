import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { AgentesController } from './agentes.controller';
import { AgentesRepository } from './agentes.repository';
import { AgentesService } from './agentes.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AgentesController],
  providers: [AgentesService, AgentesRepository],
})
export class AgentesModule {}
