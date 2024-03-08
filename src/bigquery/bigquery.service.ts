import { BigQuery } from '@google-cloud/bigquery';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';

export enum BQSInstances {
  smtr = 'smtr',
}

@Injectable()
export class BigqueryService {
  private bigQueryInstances: Record<string, BigQuery> = {};
  private logger: Logger = new Logger('BigqueryService', { timestamp: true });

  constructor(private configService: ConfigService<AllConfigType>) {
    const jsonCredentials = () => {
      const credentials = {
        type: this.configService.getOrThrow('google.clientApiType', {
          infer: true,
        }),
        project_id: this.configService.getOrThrow('google.clientApiProjectId', {
          infer: true,
        }),
        private_key_id: this.configService.getOrThrow(
          'google.clientApiPrivateKeyId',
          { infer: true },
        ),
        private_key: this.configService.getOrThrow(
          'google.clientApiPrivateKey',
          {
            infer: true,
          },
        ),
        client_email: this.configService.getOrThrow(
          'google.clientApiClientEmail',
          { infer: true },
        ),
        client_id: this.configService.getOrThrow('google.clientApiClientId', {
          infer: true,
        }),
        auth_uri: this.configService.getOrThrow('google.clientApiAuthUri', {
          infer: true,
        }),
        token_uri: this.configService.getOrThrow('google.clientApiTokenUri', {
          infer: true,
        }),
        auth_provider_x509_cert_url: this.configService.getOrThrow(
          'google.clientApiAuthProviderX509CertUrl',
          { infer: true },
        ),
        client_x509_cert_url: this.configService.getOrThrow(
          'google.clientApiClientX509CertUrl',
          { infer: true },
        ),
        universe_domain: this.configService.getOrThrow(
          'google.clientApiUniverseDomain',
          { infer: true },
        ),
      };
      for (const [k, v] of Object.entries(credentials)) {
        credentials[k] = v.replace(/\\n/g, '\n');
      }
      return credentials;
    };

    this.bigQueryInstances.smtr = new BigQuery({
      credentials: jsonCredentials(),
    });
  }

  public getBqInstance(option: BQSInstances): BigQuery {
    const bqInstance = this.bigQueryInstances[option];
    if (bqInstance !== undefined) {
      return bqInstance;
    }
    throw new HttpException(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        details: {
          message: 'invalid bqService chosen',
          bqInstances: Object.keys(this.bigQueryInstances),
          availableOptions: Object.values(BQSInstances),
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Run bigquery query with complete log and error handling
   * @throws `HttpException`
   */
  public async query(bqInstance: BQSInstances, query: string) {
    this.logger.debug('Query fetch started');
    console.log('bigquery:', query);
    try {
      const [rows] = await this.getBqInstance(bqInstance).query({
        query,
      });
      this.logger.debug(`Query fetch finished. Count: ${rows.length}`);
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
