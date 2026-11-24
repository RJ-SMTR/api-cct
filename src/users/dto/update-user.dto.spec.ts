import { ArgumentMetadata, HttpException, ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import validationOptions from 'src/utils/validation-options';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { DataSource } from 'typeorm';
import { UpdateUserRepositoryDto } from './update-user-repository.dto';
import { UpdateUserDto } from './update-user.dto';
import { validateDTO } from 'src/utils/validation-utils';

/**
 * Issue #1356: o body do PATCH /users/:id não tem `id`, então a validação de unicidade
 * de `permitCode` não pode rodar nele (barrava o próprio dono do código). A unicidade
 * fica no UpdateUserRepositoryDto, que é validado com o `id` do usuário.
 */
describe('UpdateUserDto (permitCode)', () => {
  const OWNER_ID = 10;
  const OTHER_ID = 20;
  const CODE = '123456789';
  const findOne = jest.fn();
  const dataSource = { getRepository: () => ({ findOne }) } as unknown as DataSource;

  beforeAll(() => {
    const isNotExist = new IsNotExist(dataSource);
    useContainer({ get: (cls: any) => (cls === IsNotExist ? isNotExist : new cls()) }, { fallbackOnErrors: true });
  });

  beforeEach(() => {
    findOne.mockReset();
  });

  const pipe = new ValidationPipe(validationOptions);
  const bodyMetadata: ArgumentMetadata = { type: 'body', metatype: UpdateUserDto };

  async function getBodyErrors(body: object) {
    try {
      await pipe.transform(body, bodyMetadata);
      return {};
    } catch (error) {
      return (error as HttpException).getResponse()['errors'];
    }
  }

  it('aceita salvar o card com o próprio código de permissão, sem alteração', async () => {
    findOne.mockResolvedValue({ id: OWNER_ID, permitCode: CODE });

    const errors = await getBodyErrors({ email: 'dono@example.com', permitCode: CODE });

    expect(errors).toEqual({});
    expect(findOne).not.toHaveBeenCalled();
  });

  it('mantém permitCode no body depois da validação (whitelist)', async () => {
    findOne.mockResolvedValue(null);

    const dto = await pipe.transform({ email: 'dono@example.com', permitCode: CODE }, bodyMetadata);

    expect(dto.permitCode).toBe(CODE);
  });

  it('repository DTO aceita o código do próprio usuário', async () => {
    findOne.mockResolvedValue({ id: OWNER_ID, permitCode: CODE });

    const errors = await validateDTO(UpdateUserRepositoryDto, { id: OWNER_ID, permitCode: CODE }, false);

    expect(errors).toEqual({});
  });

  it('repository DTO bloqueia o código atual de outro usuário', async () => {
    findOne.mockResolvedValue({ id: OTHER_ID, permitCode: CODE });

    const errors = await validateDTO(UpdateUserRepositoryDto, { id: OWNER_ID, permitCode: CODE }, false);

    expect(errors).toEqual({ permitCode: 'licenseeAlreadyExists' });
  });
});
