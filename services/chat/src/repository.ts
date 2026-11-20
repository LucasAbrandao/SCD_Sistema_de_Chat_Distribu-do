import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { Failure } from './domain.js';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 2000 });
export const messageColumns = 'id, conversation_id AS "conversationId", sender_id AS "senderId", client_message_id AS "clientMessageId", content, position::text, created_at AS "createdAt"';
export const conversationColumns = 'c.id,c.type,c.name,c.created_at AS "createdAt",ARRAY(SELECT user_id FROM chat.participants WHERE conversation_id=c.id ORDER BY user_id) AS "participantIds"';
export async function requireMember(id: string, userId: string) {
  const found = await pool.query('SELECT EXISTS(SELECT 1 FROM chat.conversations WHERE id=$1) AS exists, EXISTS(SELECT 1 FROM chat.participants WHERE conversation_id=$1 AND user_id=$2) AS member', [id,userId]);
  if (!found.rows[0].exists) throw new Failure(404, 'NOT_FOUND', 'Conversa inexistente.');
  if (!found.rows[0].member) throw new Failure(403, 'FORBIDDEN', 'Acesso restrito aos participantes.');
}
export async function createPrivate(ids: string[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('INSERT INTO chat.conversations(id,type,private_key) VALUES($1,\'private\',$2) ON CONFLICT(private_key) DO NOTHING RETURNING id', [randomUUID(), [...ids].sort().join(':')]);
    const created = result.rowCount === 1;
    const id = created ? result.rows[0].id : (await client.query('SELECT id FROM chat.conversations WHERE private_key=$1', [[...ids].sort().join(':')])).rows[0].id;
    if (created) for (const user of ids) await client.query('INSERT INTO chat.participants(conversation_id,user_id) VALUES($1,$2)', [id,user]);
    const conversation = (await client.query(`SELECT ${conversationColumns} FROM chat.conversations c WHERE c.id=$1`, [id])).rows[0];
    await client.query('COMMIT');
    return {created, conversation};
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
export async function persistMessage(userId: string, input: {conversationId: string; clientMessageId: string; content: string}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa a tentativa lógica inclusive quando ela é reutilizada em conversas diferentes.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [userId + ':' + input.clientMessageId]);
    await client.query('SELECT id FROM chat.conversations WHERE id=$1 FOR UPDATE', [input.conversationId]);
    const member = await client.query('SELECT 1 FROM chat.participants WHERE conversation_id=$1 AND user_id=$2', [input.conversationId,userId]);
    if (!member.rowCount) throw new Failure(403, 'FORBIDDEN', 'Acesso restrito aos participantes.');
    const previous = await client.query(`SELECT ${messageColumns} FROM chat.messages WHERE sender_id=$1 AND client_message_id=$2`, [userId,input.clientMessageId]);
    if (previous.rowCount) {
      const message = previous.rows[0];
      if (message.conversationId !== input.conversationId || message.content !== input.content) throw new Failure(409, 'CONFLICT', 'Identificador de envio reutilizado com dados diferentes.');
      await client.query('COMMIT');
      return {message, created: false};
    }
    const counter = await client.query('UPDATE chat.conversations SET position=position+1 WHERE id=$1 RETURNING position', [input.conversationId]);
    const message = (await client.query(`INSERT INTO chat.messages(id,conversation_id,sender_id,client_message_id,content,position) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${messageColumns}`, [randomUUID(),input.conversationId,userId,input.clientMessageId,input.content,counter.rows[0].position])).rows[0];
    const participants = (await client.query('SELECT user_id FROM chat.participants WHERE conversation_id=$1', [input.conversationId])).rows.map(r => r.user_id as string);
    await client.query('COMMIT');
    return {message, created: true, participants};
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
