import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationCodeDestinationEnum } from 'src/validation-code/validation-code-destination/validation-code-destination.enum';
import { ValidationCodeDestination } from 'src/validation-code/validation-code-destination/entities/validation-code-destination.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ValidationCodeDestinationSeedService {
  constructor(
    @InjectRepository(ValidationCodeDestination)
    private repository: Repository<ValidationCodeDestination>,
  ) {}

  async run() {
    for (const value in ValidationCodeDestinationEnum) {
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
            name: ValidationCodeDestinationEnum[value],
          }),
        );
      }
    }
  }
}
