import { BigQuery } from '@google-cloud/bigquery';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BigqueryService {
  private readonly bigquery = new BigQuery({
    keyFilename: '',
  });

  public async runQuery(query: string) {
    const [rows] = await this.bigquery.query({
      query,
    });
    return rows;
  }
}
