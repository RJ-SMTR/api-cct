import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { endOfDay, isFriday, nextFriday, startOfDay, subDays } from 'date-fns';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { Between, In, IsNull, Like } from 'typeorm';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';
import { LancamentoDto } from './dtos/lancamentoDto';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoEntity } from './lancamento.entity';
import { LancamentoRepository } from './lancamento.repository';

@Injectable()
export class LancamentoService {
  private readonly logger = new CustomLogger(LancamentoService.name, {
    timestamp: true,
  });

  constructor(
    private readonly lancamentoRepository: LancamentoRepository,
    private readonly usersService: UsersService,
  ) {}

  // /**
  //  * Get unused data (no Transacao Id) from current payment week (thu-wed / qui-qua).
  //  */
  // async findByLancamentos(lancamentos: LancamentoEntity[]): Promise<LancamentoEntity[]> {
  //   const ids = lancamentos.map(i => i.id);
  //   const found = await this.lancamentoRepository.findMany({
  //     where: {
  //       id: In(ids)
  //     }
  //   });
  //   return found;
  // }

  /**
   * Get unused data (no Transacao Id) from current payment week (sex-qui).
   */
  findToPayWeek(): Promise<LancamentoEntity[]> {
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const sex = startOfDay(subDays(friday, 7));
    const qui = endOfDay(subDays(friday, 1));
    return this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(sex, qui),
        transacao: IsNull(),
        auth_usersIds: Like('%,%'), // At least 2 approved (1 comma)
      },
    });
  }

  async findByPeriod(
    month?: number,
    period?: number,
    year?: number,
    authorized?: number,
  ): Promise<ItfLancamento[]> {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    this.logger.debug(String(`Find Lancamento by period: ${period}`));
    if (
      month && period && year &&
      !isNaN(month) &&
      !isNaN(period) &&
      !isNaN(year) &&
      typeof month === 'number' &&
      typeof period === 'number' &&
      typeof year === 'number'
    ) {
      [startDate, endDate] = this.getMonthDateRange(year, month, period);
      this.logger.debug(String(`${startDate}, ${endDate}`));
    }

    const whereOptions: any = {};
    if (startDate && endDate) {
      whereOptions.data_lancamento = Between(startDate, endDate);
    }

    const lancamentos = await this.lancamentoRepository.findMany({
      where: whereOptions,
      relations: ['user'],
    });

    const allUserIds = new Set<number>();
    lancamentos.forEach((lancamento) => {
      if (lancamento.auth_usersIds) {
        lancamento.auth_usersIds
          .split(',')
          .forEach((id) => allUserIds.add(Number(id)));
      }
    });

    let usersMap = new Map<number, any>();
    if (allUserIds.size > 0) {
      const users = await this.usersService.findMany({
        where: {
          id: In([...allUserIds]),
        },
      });
      usersMap = new Map(users.map((user) => [user.id, user]));
    }

    const lancamentosComUsuarios = lancamentos.map((lancamento) => {
      const userIds = lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [];
      const autorizadopor: number[] = userIds
        .map((id) => usersMap.get(id))
        .filter((user) => user !== undefined);
      return {
        ...lancamento.toItfLancamento(),
        autorizadopor: autorizadopor,
      } as ItfLancamento;
    });

    if (authorized === 1) {
      this.logger.debug('AUTHORIZED 1');
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length === 2,
      );
    }

    if (authorized === 0) {
      this.logger.debug('AUTHORIZED 0');
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length < 2,
      );
    }

    return lancamentosComUsuarios;
  }

  async findByStatus(status: number | null = null): Promise<ItfLancamento[]> {
    const lancamentos = await this.lancamentoRepository.findMany({
      relations: ['user'],
    });

    const allUserIds = new Set<number>();
    lancamentos.forEach((lancamento) => {
      lancamento.auth_usersIds
        ?.split(',')
        .forEach((id) => allUserIds.add(Number(id)));
    });

    let usersMap = new Map<number, any>();
    if (allUserIds.size > 0) {
      const users = await this.usersService.findMany({
        where: {
          id: In([...allUserIds]),
        },
      });
      usersMap = new Map(users.map((user) => [user.id, user]));
    }

    const lancamentosComUsuarios = lancamentos.map((lancamento) => {
      const userIds = lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [];
      const autorizadopor = userIds
        .map((id) => usersMap.get(id))
        .filter((user) => user);
      return {
        ...lancamento.toItfLancamento(),
        autorizadopor,
      } as ItfLancamento;
    });

    if (status === 1) {
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length === 2,
      );
    } else {
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length !== 2,
      );
    }
  }

  async getValorAutorizado(
    month: number,
    period: number,
    year: number,
  ): Promise<any> {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);

    const response = await this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(startDate, endDate),
      },
    });

    const filteredResponse = response.filter(
      (item) => item.auth_usersIds && item.auth_usersIds.split(',').length >= 2,
    );
    this.logger.debug(`filteredResponse: ${filteredResponse}`);

    const sumOfValues = filteredResponse.reduce(
      (acc, curr) => acc + curr.valor,
      0,
    );

    const formattedSum = sumOfValues.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const resp = {
      valor_autorizado: String(formattedSum),
    };

    return resp;
  }

  async create(
    lancamentoData: LancamentoDto,
    userId: number,
  ): Promise<LancamentoEntity> {
    const newLancamento = this.lancamentoRepository.create(lancamentoData);
    newLancamento.userId = userId;
    return await this.lancamentoRepository.save(newLancamento);
  }

  async autorizarPagamento(
    userId: number,
    lancamentoId: string,
    AutorizaLancamentoDto: AutorizaLancamentoDto,
  ): Promise<ItfLancamento> {
    const user = await this.usersService.findOne({
      id: userId,
    });

    if (!user)
      throw new HttpException(
        'Usuário não encontrado',
        HttpStatus.UNAUTHORIZED,
      );

    const isValidPassword = await bcrypt.compare(
      AutorizaLancamentoDto.password,
      user.password,
    );

    if (!isValidPassword)
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);

    const lancamento = await this.lancamentoRepository.findOne({
      where: { id: parseInt(lancamentoId) },
    });

    if (!lancamento) {
      throw new Error('Lançamento não encontrado.');
    }

    const userIds = new Set(
      lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [],
    );
    userIds.add(userId);

    lancamento.auth_usersIds = Array.from(userIds).join(',');
    return (await this.lancamentoRepository.save(lancamento)).toItfLancamento();
  }

  async update(
    id: number,
    updatedData: LancamentoDto,
    userId: number,
  ): Promise<ItfLancamento> {
    let lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }

    const { id_cliente_favorecido, ...restUpdatedData } = updatedData;
    lancamento = new LancamentoEntity({
      ...lancamento,
      ...restUpdatedData,
      userId,
      auth_usersIds: '',
    });

    await this.lancamentoRepository.save(lancamento);
    this.logger.log(`Lancamento ${id_cliente_favorecido} atualizado`);

    return lancamento.toItfLancamento();
  }

  async getById(id: number): Promise<ItfLancamento> {
    const lancamento = await this.lancamentoRepository.findOne({
      where: { id },
    });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    return lancamento.toItfLancamento();
  }

  async delete(id: number): Promise<void> {
    await this.lancamentoRepository.delete(id);
  }

  getMonthDateRange(year: number, month: number, period: number): [Date, Date] {
    let startDate: Date;
    let endDate: Date;

    if (period === 1) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month - 1, 15);
      endDate.setHours(23, 59, 59);
    } else if (period === 2) {
      startDate = new Date(year, month - 1, 16);
      endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59);
    } else {
      throw new Error('Invalid period. Period should be 1 or 2.');
    }
    return [startDate, endDate];
  }

  getDatePeriodInfo(date: Date) {
    const year = date.getFullYear();
    /** Os meses no JavaScript vão de 0 a 11, então é necessário adicionar 1 */
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (day <= 15) {
      return { year, month, period: 1 };
    } else {
      return { year, month, period: 2 };
    }
  }
}
