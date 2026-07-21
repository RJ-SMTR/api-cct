import { Injectable } from '@nestjs/common';
import { BigqueryService, BigquerySource } from 'src/bigquery/bigquery.service';
import { AgenteBigqueryUser } from './interfaces/agente-bigquery-user.interface';

@Injectable()
export class AgentesBigqueryRepository {
  constructor(private readonly bigqueryService: BigqueryService) { }

  async findUsersToSync(): Promise<AgenteBigqueryUser[]> {
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
        CAST(nome_fantasia AS STRING) AS nome_fantasia
      FROM \`rj-smtr.riorotativo.guardador_veiculo\`
      WHERE email IS NOT NULL
    `;

    const rows = await this.bigqueryService.query(BigquerySource.smtr, query);
    return rows as AgenteBigqueryUser[];
  }
}
