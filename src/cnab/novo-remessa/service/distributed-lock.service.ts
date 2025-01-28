import { Injectable } from '@nestjs/common';
import { DistributedLockRepository } from '../repository/distributed-lock.repository';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class DistributedLockService {
  private logger = new CustomLogger(DistributedLockService.name, { timestamp: true });

  constructor(private readonly distributedLockRepository: DistributedLockRepository) {}

  public async acquireLock(lockKey: string): Promise<boolean> {
    this.logger.debug(`Attempting to acquire lock for key: ${lockKey}`);
    return await this.distributedLockRepository.acquireLock(lockKey);
  }

  public async releaseLock(lockKey: string): Promise<void> {
    this.logger.debug(`Releasing lock for key: ${lockKey}`);
    await this.distributedLockRepository.releaseLock(lockKey);
  }
}