import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationCodeMethodEnum } from 'src/validation-code/validation-code-method/validation-code-method.enum';
import { ValidationCodeMethod } from 'src/validation-code/validation-code-method/entities/validation-code-method.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ValidationCodeMethodSeedService {
  constructor(
    @InjectRepository(ValidationCodeMethod)
    private repository: Repository<ValidationCodeMethod>,
  ) {}

  async run() {
    for (const value in ValidationCodeMethodEnum) {
      if (isNaN(Number(value))) {
        continue;
      }

      const count = await this.repository.count({
        where: {
          name: value,
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: Number(value),
            name: ValidationCodeMethodEnum[value],
          }),
        );
      }
    }
  }
}
