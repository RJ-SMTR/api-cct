export class RemessaCaixaDTO {
  fileId: string;
  fileCreationDatetime?: Date;

  senderName: string;
  senderBankCode: string;
  senderAgency: string;
  senderAccount: string;
  senderAccountDigit: string;
  senderCpfCnpj: string;
  /** Logradouro */
  senderPlace: string;
  /** Complemento logradouro */
  senderPlaceCompliment: string;
  /** Número logradouro */
  senderPlaceNumber: string;
  senderPostal: string;
  senderState: string;
  senderCity: string;
  senderNeighborhood: string;

  recipientName: string;
  recipientBankCode: string;
  recipientAgency: string;
  recipientAccount: string;
  recipientAccountDigit: string;
  recipientCpfCnpj: string;
}
