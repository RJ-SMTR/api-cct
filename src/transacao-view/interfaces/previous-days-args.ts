export interface IPreviousDaysArgs {
  startDate: Date;
  endDate: Date;
  cpfCnpjs: string[];
  pageStart?: number;
  pageLimit?: number;
}
