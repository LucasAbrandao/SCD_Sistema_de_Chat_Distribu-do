export class Failure extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function ensure(condition: unknown, message = 'Entrada inválida.'): asserts condition {
  if (!condition) throw new Failure(400, 'VALIDATION_ERROR', message);
}
export function credentials(input: unknown): {username: string; password: string} {
  ensure(input && typeof input === 'object' && !Array.isArray(input));
  const body = input as Record<string, unknown>;
  ensure(Object.keys(body).every(k => ['username', 'password'].includes(k)));
  ensure(typeof body.username === 'string' && /^[a-z0-9_]{3,32}$/.test(body.username));
  ensure(typeof body.password === 'string' && [...body.password].length >= 12 && [...body.password].length <= 128);
  return body as {username: string; password: string};
}
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function pagination(query: Record<string, unknown>) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  ensure(Number.isInteger(limit) && limit >= 1 && limit <= 100);
  ensure(query.after === undefined || uuid(query.after));
  return { limit, after: query.after ?? null };
}
