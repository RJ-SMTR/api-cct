import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CustomLogger } from './utils/custom-logger';

@Injectable()
export class AppService implements OnModuleInit {
  private logger: CustomLogger = new CustomLogger(AppService.name, {
    timestamp: true,
  });

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    await this.applyHotfix();
  }

  async applyHotfix() {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      this.logger.log('Applying preventive hotfix...');
      await queryRunner.connect();
      /**
       * Unaccent
       *
       * Sometimes the unaccent extension is dropped with no reason so far.
       * To prevent it, everytime Nest runs, it will re-install this extension.
       */
      await queryRunner.query('DROP EXTENSION IF EXISTS unaccent');
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    } catch (error) {
      this.logger.error(
        `Falha ao rodar o hotfix - ${error?.message}`,
        error?.stack,
      );
    } finally {
      await queryRunner.release();
      this.logger.log('Preventive hotfix applied!');
    }
  }
}
