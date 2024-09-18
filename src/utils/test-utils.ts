import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral } from 'typeorm';
import { TransacaoView } from '../../src/transacao-view/transacao-view.entity';

export class TestUtils {
  private app: INestApplication;
  private dataSource: DataSource;

  async initializeApp(moduleFixture: TestingModule): Promise<INestApplication> {
    this.app = moduleFixture.createNestApplication();
    await this.app.init();
    return this.app;
  }

  async closeApp(): Promise<void> {
    await this.dataSource.destroy();
    await this.app.close();
  }

  getRepository<T extends ObjectLiteral>(entity: new () => T) {
    return this.dataSource.getRepository(entity);
  }

  static getTypeOrmModuleOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: process.env.UNITTEST_DATABASE_HOST || 'localhost',
      port: Number(process.env.UNITTEST_DATABASE_PORT) || 5432,
      username: process.env.UNITTEST_DATABASE_USERNAME,
      password: process.env.UNITTEST_DATABASE_PASSWORD,
      database: process.env.UNITTEST_DATABASE_NAME,
      entities: [TransacaoView],
      synchronize: true,
      dropSchema: true,
    };
  }

  static getTestModule() {
    return Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(TestUtils.getTypeOrmModuleOptions()), TypeOrmModule.forFeature([TransacaoView])],
      // services here...
    });
  }

  async resetDatabase(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;

    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE ${entity.tableName} RESTART IDENTITY CASCADE;`);
    }
  }
}
