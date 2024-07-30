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
};
