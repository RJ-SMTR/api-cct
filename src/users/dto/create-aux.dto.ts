import { IsNotEmpty,IsString, IsInt, Length } from 'class-validator';

export class CreateAuxUserDesativadoDto {
    @IsNotEmpty()
    @IsString()
    @Length(1, 255)
    fullName: string;

    @IsNotEmpty()
    @IsString()
    @Length(11, 20)
    cpfCnpj: string;

    @IsString()
    @IsNotEmpty()
    @Length(1, 50)
    permitCode: string;

    @IsNotEmpty()
    @IsInt()
    idUser: number;
}
