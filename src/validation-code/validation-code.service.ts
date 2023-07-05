import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptions } from 'src/utils/types/find-options.type';
import {
  DeepPartial,
  Equal,
  FindManyOptions,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ValidationCode } from './entities/validation-code.entity';
import { NullableType } from '../utils/types/nullable.type';
import * as bcrypt from 'bcryptjs';
import { BaseValidationCodeInterface } from './interfaces/base-validation-code.interface';
import { toUTC } from 'src/utils/helpers/to-utc';

@Injectable()
export class ValidationCodeService {
  constructor(
    @InjectRepository(ValidationCode)
    private validationCodeRepository: Repository<ValidationCode>,
  ) {}

  async findOne(
    options: FindOptions<ValidationCode>,
  ): Promise<NullableType<ValidationCode>> {
    return this.validationCodeRepository.findOne({
      where: options.where,
    });
  }

  async findMany(
    options: FindManyOptions<ValidationCode>,
  ): Promise<ValidationCode[]> {
    return this.validationCodeRepository.find(options);
  }

  async create(data: DeepPartial<ValidationCode>): Promise<ValidationCode> {
    return this.validationCodeRepository.save(
      this.validationCodeRepository.create(data),
    );
  }

  async softDelete(id: number): Promise<void> {
    await this.validationCodeRepository.softDelete(id);
  }

  async createEncrypted(
    baseData: BaseValidationCodeInterface,
    code: string,
    encryptCallback?: (code: string) => Promise<string>,
  ): Promise<ValidationCode> {
    let hash: string;

    if (!encryptCallback) {
      const saltOrRounds = 10;
      const password = code;
      hash = await bcrypt.hash(password, saltOrRounds);
    } else {
      hash = await encryptCallback(code);
    }
    baseData;

    return this.create({
      hash: hash,
      ...baseData,
    });
  }

  async findDecrypt(
    baseData: BaseValidationCodeInterface,
    code: string,
    decryptCallback?: (encryptedCode: string) => Promise<boolean>,
  ): Promise<ValidationCode> {
    const now = new Date();

    const validationCode = await this.validationCodeRepository.findOne({
      where: {
        expiresAt: MoreThanOrEqual(now),
        method: baseData.method,
        destination: baseData.destination,
        user: Equal(baseData.user.id),
      },
      order: {
        createdAt: 'DESC',
      },
      withDeleted: true,
    });

    console.log(`del: ${validationCode?.deletedAt}`);
    console.log(`cre: ${validationCode?.createdAt}`);
    console.log(`exp: ${validationCode?.expiresAt}`);
    console.log(`now: ${now}`);
    console.log(`UTC: ${toUTC(now)}`);

    if (!validationCode || validationCode.deletedAt !== null) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: `codeNotFound`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    let isMatch: boolean;
    if (decryptCallback !== undefined) {
      isMatch = await decryptCallback(code);
    } else {
      isMatch = await bcrypt.compare(code, validationCode.hash);
    }

    await this.softDelete(validationCode.id);

    if (!isMatch) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: `codeNotMatch`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return validationCode;
  }
}
