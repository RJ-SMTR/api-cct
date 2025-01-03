import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { Between } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { StatusRemessaEnum } from '../../enums/novo-remessa/status-remessa.enum';
import { UsersService } from '../../../users/users.service';

@Injectable()
export class OrdemPagamentoAgrupadoService {
  private logger = new CustomLogger(OrdemPagamentoAgrupadoService.name, { timestamp: true });

  constructor(
    private ordemPamentoRepository: OrdemPagamentoRepository, 
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private ordemPamentoAgrupadoHistRepository: OrdemPagamentoAgrupadoHistoricoRepository,
    private pagadorService: PagadorService,
    private usersService: UsersService,
  ) {}   
 
  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto:Date, pagadorKey: keyof AllPagadorDict) {
    this.logger.debug(`Preparando agrupamentos`)
    const pagador = await this.getPagador(pagadorKey);
    if(pagador) {
      await this.agruparOrdens(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador);
    }
  }

  async getPagador(pagadorKey: any) {
    return (await this.pagadorService.getAllPagador())[pagadorKey];
  } 

  async agruparOrdens(dataInicial: Date, dataFinal: Date, dataPgto:Date, pagador: Pagador) {
    await this.ordemPamentoRepository.agruparOrdensDePagamento(dataInicial, dataFinal, dataPgto, pagador);
  }

  async buildHistoricoFromOrdemPagamentoAgrupado(ordemPagamentoAgrupado: OrdemPagamentoAgrupado): Promise<OrdemPagamentoAgrupadoHistorico> {
    // comente o código abaixo para testes, se necessário
    const userId = ordemPagamentoAgrupado.ordensPagamento.find(op => op.userId !== undefined)?.userId;
    if (!userId) {
      this.logger.error('Nenhum usuário encontrado para a ordem de pagamento');
      throw new Error('Nenhum usuário encontrado para a ordem de pagamento');
    }

    const user = await this.usersService.getOne({ id: userId });
    if (!user.bankAccount || !user.bankAccountDigit || !user.bankAgency || !user.bankCode) {
      this.logger.error('Dados bancários do usuário não encontrados');
      throw new Error('Dados bancários do usuário não encontrados');
    }

    const ordemPagamentoAgrupadoHistorico = new OrdemPagamentoAgrupadoHistorico();
    ordemPagamentoAgrupadoHistorico.ordemPagamentoAgrupado = ordemPagamentoAgrupado;
    ordemPagamentoAgrupadoHistorico.dataReferencia = new Date();
    ordemPagamentoAgrupadoHistorico.userBankCode = user.bankCode.toString();
    ordemPagamentoAgrupadoHistorico.userBankAgency = user.bankAgency.toString();
    ordemPagamentoAgrupadoHistorico.userBankAccount = user.bankAccount.toString();
    ordemPagamentoAgrupadoHistorico.userBankAccountDigit = user.bankAccountDigit.toString();
    ordemPagamentoAgrupadoHistorico.statusRemessa = StatusRemessaEnum.Criado;

    return ordemPagamentoAgrupadoHistorico;
  }
}