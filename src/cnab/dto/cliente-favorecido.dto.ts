import { IsNotEmpty, ValidateIf } from 'class-validator';
import { PermissionarioRole } from 'src/permissionario-role/permissionario-role.entity';
import { User } from 'src/users/entities/user.entity';
import { DeepPartial } from 'typeorm';

function isCreate(object: SaveClienteFavorecidoDTO): boolean {
  return object.id === undefined;
}

export class SaveClienteFavorecidoDTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nome?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpfCnpj?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBanco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  contaCorrente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvContaCorrente?: string;

  permissionarioRole?: DeepPartial<PermissionarioRole> | null;

  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  complementoCep?: string | null;
  uf?: string | null;
  user?: DeepPartial<User>;
}
