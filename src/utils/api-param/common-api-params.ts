import { ApiParamOptions } from '@nestjs/swagger';
import { ApiDescription } from './description-api-param';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const CommonApiParams = {
  userId: {
    name: 'userId',
    type: Number,
    required: false,
    description: ApiDescription({
      default: 'Your logged user id (me / request.user.id)',
    }),
  } as ApiParamOptions,
  ordemPagamentoAgrupadoId: {
    name: 'ordemPagamentoAgrupadoId',
    type: Number,
    required: true,
    description: ApiDescription({
      default: 'O ID das ordem pagamento agrupadas',
    }),
  },
  ordemPagamentoId: {
    name: 'ordemPagamentoId',
    type: Number,
    required: true,
    description: ApiDescription({
      default: 'O ID da ordem de pagamento',
    }),
  }
};
