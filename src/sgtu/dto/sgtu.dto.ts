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

  vehicleOrderNumberId: number;

  rg?: string;

  vehiclePlate?: string;

  phone?: string;
}
