import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AutorizaLancamentoDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    password: string;
  }