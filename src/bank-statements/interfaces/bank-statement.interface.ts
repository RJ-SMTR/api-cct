export interface IBankStatement {
  id: number;
  permitCode: string;
  cpfCnpj: string;
  date: string;
  amount: number;
  status: string;
  statusCode: string;
}
