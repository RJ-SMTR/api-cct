import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgendamentoPagamentoController } from "./controller/agendamento-pagamento.controlller";
import { AgendamentoPagamentoService } from "./service/agendamento-pagamento.service";
import { AgendamentoPagamentoRepository } from "./repository/agendamento-pagamento.repository";
import { AgendamentoPagamento } from "./domain/entity/agendamento-pagamento.entity";
import { AgendamentoPagamentoConvert } from "./convert/agendamento-pagamento.convert";

@Module({
    imports: [
        TypeOrmModule.forFeature([AgendamentoPagamento]),
    ],
    controllers: [AgendamentoPagamentoController],
    providers: [
        AgendamentoPagamentoService,
        AgendamentoPagamentoRepository,
        AgendamentoPagamentoConvert,
    ],
})
export class AgendamentoPagamentoModule { }
