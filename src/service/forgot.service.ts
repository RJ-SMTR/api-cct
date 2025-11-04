import * as crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Forgot } from '../domain/entity/forgot.entity';
import { Nullable } from '../utils/types/nullable.type';
import { FindOptions } from 'src/utils/types/find-options.type';

@Injectable()
export class ForgotService {
  constructor(
    @InjectRepository(Forgot)
    private readonly forgotRepository: Repository<Forgot>,
  ) {}

  async findOne(options: FindOptions<Forgot>): Promise<Nullable<Forgot>> {
    return this.forgotRepository.findOne({
      where: options.where,
    });
  }

  async findMany(options: FindOptions<Forgot>): Promise<Forgot[]> {
    return this.forgotRepository.find({
      where: options.where,
    });
  }

  async create(data: DeepPartial<Forgot>): Promise<Forgot> {
    return this.forgotRepository.save(this.forgotRepository.create(data));
  }

  async softDelete(id: number): Promise<void> {
    await this.forgotRepository.softDelete(id);
  }

  async generateHash(): Promise<string> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.findOne({ where: { hash } })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }
    return hash;
  }
}
