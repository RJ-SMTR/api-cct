import { Injectable } from '@nestjs/common';
import { BigqueryService, BigquerySource } from 'src/bigquery/bigquery.service';
import { AgenteBigqueryUser } from './interfaces/agente-bigquery-user.interface';

@Injectable()
export class AgentesBigqueryRepository {
  constructor(private readonly bigqueryService: BigqueryService) { }

  async findUsersToSync(updatedSince?: string): Promise<AgenteBigqueryUser[]> {
    const whereClauses = ['1 = 1'];
    if (updatedSince) {
      whereClauses.push(
        `datetime_ultima_atualizacao >= DATETIME(TIMESTAMP('${updatedSince}'))`,
      );
    }

    const query = `
      SELECT
        CAST(numero_identificacao AS STRING) AS numero_identificacao,
        CAST(nome AS STRING) AS nome,
        CAST(email AS STRING) AS email,
        CAST(telefone AS STRING) AS telefone,
        CAST(documento AS STRING) AS documento,
        CAST(tipo_documento AS STRING) AS tipo_documento,
        CAST(cnpj AS STRING) AS cnpj,
        CAST(razao_social AS STRING) AS razao_social,
        CAST(nome_fantasia AS STRING) AS nome_fantasia,
        CAST(datetime_ultima_atualizacao AS STRING) AS datetime_ultima_atualizacao
      FROM \`rj-smtr.riorotativo.guardador_veiculo\`
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY datetime_ultima_atualizacao ASC
    `;

    const rows = await this.bigqueryService.query(BigquerySource.smtr, query);
    return rows as AgenteBigqueryUser[];
  }
}
