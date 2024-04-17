import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { User } from 'src/users/entities/user.entity';
import { Between, In, IsNull, Like, Repository } from 'typeorm';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoEntity } from './lancamento.entity';
import { LancamentoRepository } from './lancamento.repository';

@Injectable()
export class LancamentoService {
  constructor(
    private readonly lancamentoRepository: LancamentoRepository,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

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
   * Get unused data (no Transacao Id) from current payment week (thu-wed / qui-qua).
   */
  findToPayToday(): Promise<LancamentoEntity[]> {
    const today = new Date();
    return this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(startOfDay(today), endOfDay(today)),
        transacao: IsNull(),
        auth_usersIds: Like('%,%'),
      }
    });
  }

  async findByPeriod(
    month: number,
    period: number,
    year: number,
  ): Promise<ItfLancamento[]> {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);
    const lancamentos = await this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(startDate, endDate),
      },
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
      const users = await this.userRepository.findBy({
        id: In([...allUserIds]),
      });
      usersMap = new Map(users.map((user) => [user.id, user]));
    }

    const lancamentosComUsuarios = lancamentos.map((lancamento) => {
      const userIds = lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [];
      const autorizadopor = userIds
        .map((id) => usersMap.get(id))
        .filter((user) => user !== undefined);
      return { ...lancamento, autorizadopor };
    });

    return lancamentosComUsuarios;
  }

  async create(
    lancamentoData: ItfLancamento,
    userId: number,
  ): Promise<ItfLancamento> {
    const newLancamento = this.lancamentoRepository.create(lancamentoData);
    newLancamento.userId = userId;
    return await this.lancamentoRepository.save(newLancamento);
  }

  async autorizarPagamento(
    userId: number,
    lancamentoId: string,
  ): Promise<ItfLancamento> {
    const lancamento = await this.lancamentoRepository.findOne({
      where: { id: parseInt(lancamentoId) },
    });
    console.log;

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
    return await this.lancamentoRepository.save(lancamento);
  }

  async update(
    id: number,
    updatedData: ItfLancamento,
    userId: number,
  ): Promise<ItfLancamento> {
    let lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }

    const { id_cliente_favorecido, ...restUpdatedData } = updatedData;
    lancamento = new LancamentoEntity({ ...lancamento, ...restUpdatedData, userId, auth_usersIds: '' });

    await this.lancamentoRepository.save(lancamento);
    console.log(id_cliente_favorecido);

    return lancamento;
  }

  async getById(id: number): Promise<ItfLancamento> {
    const lancamento = await this.lancamentoRepository.findOne({
      where: { id },
    });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    return lancamento;
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
    } else if (period === 2) {
      startDate = new Date(year, month - 1, 16);
      endDate = new Date(year, month, 0);
    } else {
      throw new Error('Invalid period. Period should be 1 or 2.');
    }
    return [startDate, endDate];
  }
}
