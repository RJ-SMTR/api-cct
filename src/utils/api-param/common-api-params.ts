import { ApiParamOptions } from '@nestjs/swagger';
import { DescriptionApiParam } from './description-api-param';

/**
 * @type `Record<string, ApiParamOptions>`
 */
export const CommonApiParams = {
  userId: {
    name: 'userId',
    type: Number,
    required: false,
    description: DescriptionApiParam({
      default: 'Your logged user id (me / request.user.id)',
    }),
  } as ApiParamOptions,
};
