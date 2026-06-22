import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgendamentoPagamentoController } from "./controller/agendamento-pagamento.controlller";
import { AgendamentoPagamentoService } from "./service/agendamento-pagamento.service";
import { AgendamentoPagamentoRepository } from "./repository/agendamento-pagamento.repository";
import { AgendamentoPagamento } from "./domain/entity/agendamento-pagamento.entity";
import { AgendamentoPagamentoConvert } from "./convert/agendamento-pagamento.convert";
import { AprovacaoPagamentoController } from "./controller/aprovacao-pagamento.controlller";
import { AprovacaoPagamentoConvert } from "./convert/aprovacao-pagamento.convert";
import { AprovacaoPagamentoRepository } from "./repository/aprovacao-pagamento.repository";
import { AprovacaoPagamentoService } from "./service/aprovacao-pagamento.service";
import { AprovacaoPagamento } from "./domain/entity/aprovacao-pagamento.entity";
import { UsersModule } from "src/users/users.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([AgendamentoPagamento, AprovacaoPagamento]),UsersModule,
    ],
    controllers: [AgendamentoPagamentoController, AprovacaoPagamentoController],
    providers: [
        AgendamentoPagamentoService,
        AgendamentoPagamentoRepository,
        AgendamentoPagamentoConvert,
        AprovacaoPagamentoConvert,
        AprovacaoPagamentoRepository,
        AprovacaoPagamentoService
    ],
    exports: [
        AgendamentoPagamentoService,
        AprovacaoPagamentoService,
        AgendamentoPagamentoRepository,
        AprovacaoPagamentoRepository,
    ],
})
export class AgendamentoPagamentoModule { }
