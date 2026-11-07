import initSqlJs, { type Database as SqlDatabase, type SqlJsStatic, type SqlValue } from 'sql.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const file = resolve(process.env.DATABASE_PATH || './data/gyvora.sqlite');
mkdirSync(dirname(file), { recursive: true });
const SQL: SqlJsStatic = await initSqlJs({ locateFile: (name) => require.resolve(`sql.js/dist/${name}`) });
const database: SqlDatabase = existsSync(file) ? new SQL.Database(readFileSync(file)) : new SQL.Database();
database.run('PRAGMA foreign_keys = ON');
database.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('owner', 'client')),
    qr_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'frozen', 'deleted')),
    admin_note TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS account_messages (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS account_messages_recipient_idx
    ON account_messages(recipient_id, created_at DESC);
`);
const userColumns = new Set(rows(database.prepare('PRAGMA table_info(users)')).map(column => String(column['name'])));
if (!userColumns.has('account_status')) database.run("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'frozen', 'deleted'))");
if (!userColumns.has('admin_note')) database.run("ALTER TABLE users ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''");
database.run("UPDATE users SET account_status='deleted' WHERE is_active=0 AND account_status='active'");
persist();

function persist() {
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryFile, Buffer.from(database.export()));
    renameSync(temporaryFile, file);
  } catch (error) {
    if (existsSync(temporaryFile)) unlinkSync(temporaryFile);
    throw error;
  }
}

function normalizeParams(params: unknown[]): SqlValue[] {
  return params.map((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value as SqlValue;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Uint8Array) return value;
    throw new TypeError(`Unsupported SQLite parameter type: ${typeof value}`);
  });
}

function rows(statement: ReturnType<SqlDatabase['prepare']>) {
  const result: Record<string, unknown>[] = [];
  while (statement.step()) result.push(statement.getAsObject());
  return result;
}

export const db = {
  exec(sql: string) {
    database.exec(sql);
    persist();
  },
  pragma(_sql: string) {
    // sql.js uses a single-process in-memory SQLite engine backed by a durable file export.
  },
  prepare(sql: string) {
    return {
      get(...params: unknown[]) {
        const statement = database.prepare(sql);
        try {
          statement.bind(normalizeParams(params));
          return rows(statement)[0];
        } finally {
          statement.free();
        }
      },
      all(...params: unknown[]) {
        const statement = database.prepare(sql);
        try {
          statement.bind(normalizeParams(params));
          return rows(statement);
        } finally {
          statement.free();
        }
      },
      run(...params: unknown[]) {
        database.run(sql, normalizeParams(params));
        const changes = database.getRowsModified();
        persist();
        return { changes };
      },
    };
  },
};
