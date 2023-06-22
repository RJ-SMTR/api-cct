import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Info } from './entities/info.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class InfoService {
  constructor(
    @InjectRepository(Info)
    private readonly infoRepository: Repository<Info>,
  ) {}

  async getAll(): Promise<Info[]> {
    return this.infoRepository.find();
  }
}
