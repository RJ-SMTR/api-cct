import { IsNotEmpty } from 'class-validator';

export class SgtuDto {
  id?: string;

  fullName: string;

  @IsNotEmpty()
  cpfCnpj: string;

  @IsNotEmpty()
  permitCode: string;

  isSgtuBlocked: boolean;

  @IsNotEmpty()
  email: string;

  rg?: string;

  plate?: string;

  phone?: string;
}
