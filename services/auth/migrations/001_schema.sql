-- Base idempotente; tabelas de negócio pertencem ao próximo marco.
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
COMMIT;
