import { BigQuery } from '@google-cloud/bigquery';
import { Controller } from '@nestjs/common';

@Controller('bigquery')
export class BigqueryController {
  private readonly bigquery = new BigQuery({
    keyFilename: 'path-to-your-key-file.json',
    projectId: 'your-project-id',
  });
}
