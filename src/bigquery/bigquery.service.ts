import { BigQuery } from '@google-cloud/bigquery';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';

export enum BigqueryServiceInstances {
  bqSmtr,
}

@Injectable()
export class BigqueryService {
  private readonly bqSmtr: BigQuery;
  private logger: Logger = new Logger('BigqueryService', { timestamp: true });

  constructor(private configService: ConfigService<AllConfigType>) {
    const jsonCredentials = () =>
      this.configService.getOrThrow('google.clientApiJson', { infer: true });
    this.bqSmtr = new BigQuery({
      credentials: JSON.parse(jsonCredentials()),
    });
  }

  public getBqInstance(option: BigqueryServiceInstances): BigQuery {
    if (option === BigqueryServiceInstances.bqSmtr) {
      return this.bqSmtr;
    }
    throw new HttpException(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'getBqService(): invalid service found',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Run bigquery query with complete log and error handling
   * @throws `HttpException`
   */
  public async runQuery(bqInstance: BigqueryServiceInstances, query: string) {
    console.log('bigquery:', query);
    this.logger.debug('Query fetch started');
    try {
      const [rows] = await this.getBqInstance(bqInstance).query({
        query,
      });
      this.logger.debug('Query fetch finished');
      return rows;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            message: String(error),
            error,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
