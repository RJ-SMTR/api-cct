import { IsString, IsDate, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BigqueryTransacaoDiarioDto {
    @IsString()
    id_transacao?: string;

    @IsDate()
    @Type(() => Date)
    data?: Date;

    @IsDate()
    @Type(() => Date)
    datetime_transacao?: Date;

    @IsString()
    consorcio?: string;

    @IsNumber()
    valor_pagamento?: number;

    @IsString()
    id_ordem_pagamento?: string;
    
    @IsString()
    tipo_transacao?: string;

    @IsString()
    id_ordem_pagamento_consorcio_operador_dia?: string;

    @IsDate()
    @Type(() => Date)
    datetime_ultima_atualizacao?: Date;
}
