import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Uma sessão mantém o lock durante toda a execução; cada arquivo tem sua transação.
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(9142026)");
  for (const service of ['auth', 'chat']) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${service}`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${service}.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const file of (await readdir(`services/${service}/migrations`)).filter(f => f.endsWith('.sql')).sort()) {
      const sql = await readFile(`services/${service}/migrations/${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const previous = await client.query(`SELECT checksum FROM ${service}.schema_migrations WHERE version=$1`, [file]);
      if (previous.rowCount) {
        if (previous.rows[0].checksum !== checksum) throw new Error(`Migração alterada: ${service}/${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        // Os arquivos iniciais já continham BEGIN/COMMIT. O executor assume a transação.
        await client.query(sql.replace(/^\s*(BEGIN|COMMIT);\s*$/gmi, ''));
        await client.query(`INSERT INTO ${service}.schema_migrations(version,checksum) VALUES($1,$2)`, [file, checksum]);
        await client.query('COMMIT');
        console.log(`Aplicada ${service}/${file}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  }
} finally { await client.end(); }
