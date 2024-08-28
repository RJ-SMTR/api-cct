export interface IBqFindTransacao {
  cpfCnpj?: string;
  manyCpfCnpj?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
  valor_pagamento?: number[] | null | ['>=' | '<=' | '>' | '<', number] | 'NOT NULL';
  id_transacao?: string[] | null;
}
