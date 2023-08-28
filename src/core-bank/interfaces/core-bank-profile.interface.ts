export interface CoreBankProfileInterface {
  id?: string;
  cpfCnpj: string;
  rg?: string;
  bankAgencyName?: string;
  bankCode?: number;
  bankAgencyCode?: string;
  bankAgencyDigit?: string;
  bankAccountCode?: string;
  bankAccountDigit?: string;
}