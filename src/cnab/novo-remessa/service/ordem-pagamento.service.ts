import { HttpException, Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { User } from 'src/users/entities/user.entity';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { OrdemPagamentoMensalDto } from '../dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoPendenteDto } from '../dto/ordem-pagamento-pendente.dto';
import { OrdemPagamentoPendenteRespUsuarioDto } from '../dto/ordem-pagamento-pendente-resp-usuario.dto';

@Injectable()
export class OrdemPagamentoService {
  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(private ordemPagamentoRepository: OrdemPagamentoRepository, private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService, private usersService: UsersService) {}

  async sincronizarOrdensPagamento(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date, consorcio: string[]) {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: consorcio });
    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      let user: User | undefined;
      if (ordem.operadoraCpfCnpj) {
        try {
          user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });
          if (user) {
            this.logger.debug(`Salvando a ordem: ${ordem.idOrdemPagamento} para usuario: ${user.fullName}`, METHOD);
            await this.save(ordem, user.id);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
           ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
            await this.save(ordem, undefined);
          } else {
            this.logger.error(`Erro ao sincronizar ordem de pagamento ${ordem.id}: ${error.message}`, METHOD);
          }
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
  }

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPagamentoRepository.save(ordemPagamento);
  }

  async findOrdensPagamentoAgrupadasPorMes(userId: number, yearMonth: Date): Promise<OrdemPagamentoMensalDto> {
    const ordensDoMes = await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasPorMes(userId, yearMonth);
    const ordemPagamentoMensal = new OrdemPagamentoMensalDto();
    ordemPagamentoMensal.ordens = ordensDoMes;
    ordemPagamentoMensal.valorTotal = ordensDoMes.reduce((acc, ordem) => acc + (ordem.valorTotal || 0), 0);
    ordemPagamentoMensal.valorTotalPago = ordensDoMes.reduce((acc, ordem) => {
      if (ordem.motivoStatusRemessa && ordem.motivoStatusRemessa.toString() === '00') {
        return acc + (ordem.valorTotal || 0);
      }
      return acc;
    }, 0);
    return ordemPagamentoMensal;
  }

  async findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId);
  }

  async findOrdensPagamentoPendentes(): Promise<OrdemPagamentoPendenteDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentes();
  }

  async findOrdensPagamentoPendentesPorRespUsuario(): Promise<OrdemPagamentoPendenteRespUsuarioDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentesPorResponsabilidadeUsuario();
  }

}