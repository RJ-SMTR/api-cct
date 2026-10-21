import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditoriaRequisicaoInterceptor, sanitizarCorpo } from './auditoria-requisicao.interceptor';

describe('AuditoriaRequisicaoInterceptor', () => {
  const build = (req: any, statusCode = 201) => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const contexto = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode }) }) } as any;
    return { dataSource, contexto, interceptor: new AuditoriaRequisicaoInterceptor(dataSource as any) };
  };

  it('registra escrita com usuário, rota sem query e corpo sem segredos', async () => {
    const { dataSource, contexto, interceptor } = build({ method: 'POST', originalUrl: '/users/1?x=1', user: { id: 45 }, body: { nome: 'a', password: 'segredo' }, headers: {}, ip: '::1' });
    await lastValueFrom(interceptor.intercept(contexto, { handle: () => of('ok') }));
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain('auditoria_requisicao');
    expect(params[0]).toBe(45);
    expect(params[2]).toBe('/users/1');
    expect(JSON.parse(params[4])).toEqual({ nome: 'a', password: '[omitido]' });
    expect(params[3]).toBe(201);
  });

  it('registra falhas com o status do erro e deixa o erro passar', async () => {
    const { dataSource, contexto, interceptor } = build({ method: 'DELETE', originalUrl: '/x', headers: {} });
    await expect(lastValueFrom(interceptor.intercept(contexto, { handle: () => throwError(() => ({ status: 403 })) }))).rejects.toEqual({ status: 403 });
    expect(dataSource.query.mock.calls[0][1][3]).toBe(403);
  });

  it('ignora leitura, login e a própria área de auditoria; falha de gravação não afeta a resposta', async () => {
    for (const req of [
      { method: 'GET', originalUrl: '/users', headers: {} },
      { method: 'POST', originalUrl: '/auth/email/login', headers: {} },
      { method: 'POST', originalUrl: '/auditoria/quarentena/1/aprovar', headers: {} },
    ]) {
      const { dataSource, contexto, interceptor } = build(req);
      await lastValueFrom(interceptor.intercept(contexto, { handle: () => of(1) }));
      expect(dataSource.query).not.toHaveBeenCalled();
    }
    const { dataSource, contexto, interceptor } = build({ method: 'PUT', originalUrl: '/a', headers: {} }, 200);
    dataSource.query.mockRejectedValue(new Error('banco fora'));
    await expect(lastValueFrom(interceptor.intercept(contexto, { handle: () => of('ok') }))).resolves.toBe('ok');
  });

  it('sanitizarCorpo omite chaves secretas aninhadas e encurta listas e textos grandes', () => {
    const r: any = sanitizarCorpo({ a: { token: 't', b: 'x'.repeat(600) }, lista: Array.from({ length: 30 }, (_, i) => i) });
    expect(r.a.token).toBe('[omitido]');
    expect(r.a.b.length).toBe(501);
    expect(r.lista).toHaveLength(21);
  });
});
