import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamento } from '../domain/entity/ordem-pagamento.entity';

@Injectable()
export class DistributedLockRepository {
  private logger = new CustomLogger(DistributedLockRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamento)
    private readonly repository: Repository<any>,
  ) {}

  public async acquireLock(lockKey: string): Promise<boolean> {
    const lockId = this.generateLockId(lockKey);
    const lockQuery = `SELECT pg_try_advisory_lock(${lockId})`;
    const result = await this.repository.query(lockQuery);
    return result[0].pg_try_advisory_lock;
  }

  public async releaseLock(lockKey: string): Promise<void> {
    const lockId = this.generateLockId(lockKey);
    const unlockQuery = `SELECT pg_advisory_unlock(${lockId})`;
    await this.repository.query(unlockQuery);
  }

  private generateLockId(lockKey: string): number {
    let hash = 0;
    for (let i = 0; i < lockKey.length; i++) {
      const char = lockKey.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
}