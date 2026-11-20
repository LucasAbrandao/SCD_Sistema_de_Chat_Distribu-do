import { randomUUID } from 'node:crypto';
export class Failure extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function ensure(condition: unknown, message = 'Entrada inválida.'): asserts condition {
  if (!condition) throw new Failure(400, 'VALIDATION_ERROR', message);
}
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function sendInput(input: unknown) {
  ensure(input && typeof input === 'object' && !Array.isArray(input));
  const b = input as Record<string, unknown>;
  ensure(Object.keys(b).length === 3 && Object.keys(b).every(k => ['conversationId','clientMessageId','content'].includes(k)));
  ensure(uuid(b.conversationId) && uuid(b.clientMessageId));
  ensure(typeof b.content === 'string' && b.content.trim().length > 0 && [...b.content].length <= 4000);
  return b as { conversationId: string; clientMessageId: string; content: string };
}
export function failureBody(error: unknown) {
  const e = error as {code?: string; message?: string} | null;
  const dependency = /^(08|53|57|ECONN|ETIMEDOUT|ENOTFOUND)/.test(e?.code ?? '') || /timeout|connection terminated/i.test(e?.message ?? '');
  const f = error instanceof Failure ? error : dependency ? new Failure(503, 'DEPENDENCY_UNAVAILABLE', 'Serviço temporariamente indisponível.') : new Failure(500, 'INTERNAL_ERROR', 'Falha inesperada.');
  return {status: f.status, error: {code: f.code, message: f.message, requestId: randomUUID()}};
}
export function pagination(query: Record<string, unknown>, history = false) {
  ensure(Object.keys(query).every(k => ['after','limit'].includes(k)));
  const limit = query.limit === undefined ? history ? 50 : 20 : Number(query.limit);
  ensure(Number.isInteger(limit) && limit >= 1 && limit <= 100);
  const after = query.after ?? (history ? '0' : null);
  ensure(history ? typeof after === 'string' && /^(0|[1-9][0-9]*)$/.test(after) && BigInt(after) <= 9223372036854775807n : after === null || uuid(after));
  return {limit, after};
}
