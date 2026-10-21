import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ROTAS_IGNORADAS = [/^\/?auth(\/|$)/i, /^\/?auditoria(\/|$)/i];
const CHAVES_SECRETAS = /pass|senha|token|secret|hash|authorization|cpf.?cnpj.*senha|api.?key/i;
const MAX_PROFUNDIDADE = 4;
const MAX_TEXTO = 500;

/** Remove segredos e encurta textos/listas grandes antes de gravar o corpo da requisição. */
export function sanitizarCorpo(valor: unknown, profundidade = 0): unknown {
  if (valor == null) return valor;
  if (profundidade > MAX_PROFUNDIDADE) return '[…]';
  if (typeof valor === 'string') return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor;
  if (typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) {
    const itens = valor.slice(0, 20).map((v) => sanitizarCorpo(v, profundidade + 1));
    return valor.length > 20 ? [...itens, `[+${valor.length - 20} itens]`] : itens;
  }
  if (Buffer.isBuffer(valor)) return '[arquivo]';
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, CHAVES_SECRETAS.test(k) ? '[omitido]' : sanitizarCorpo(v, profundidade + 1)]),
  );
}

/**
 * Registra em `auditoria_requisicao` as requisições de escrita (POST/PUT/PATCH/DELETE) com usuário, rota, corpo
 * sem segredos, status e duração. A gravação é assíncrona e nunca afeta a resposta.
 */
@Injectable()
export class AuditoriaRequisicaoInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaRequisicaoInterceptor.name);

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const rota: string = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (!METODOS_AUDITADOS.has(req.method) || ROTAS_IGNORADAS.some((r) => r.test(rota))) return next.handle();

    const inicio = Date.now();
    const registrar = (status: number) => {
      const corpo = req.body && Object.keys(req.body).length ? JSON.stringify(sanitizarCorpo(req.body)) : null;
      const ip = (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null;
      this.dataSource
        .query(
          `INSERT INTO auditoria_requisicao (usuario_id, metodo, rota, status_http, corpo, ip, duracao_ms) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
          [req.user?.id ?? null, req.method, rota, status, corpo, ip, Date.now() - inicio],
        )
        .catch((error) => this.logger.warn(`Falha ao registrar requisição: ${error.message}`));
    };

    return next.handle().pipe(
      tap({
        next: () => registrar(http.getResponse().statusCode),
        error: (erro) => registrar(erro?.status ?? erro?.getStatus?.() ?? 500),
      }),
    );
  }
}
