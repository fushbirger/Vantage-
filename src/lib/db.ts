import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedDatabase } from "./seed";

declare global {
  // eslint-disable-next-line no-var
  var __vantageDb: Database.Database | undefined;
}

function hasColumn(database: Database.Database, table: string, column: string) {
  const columns = database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
    name: string;
  }>;
  return columns.some((c) => c.name === column);
}

function addColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Upgrade databases created before account connections and multi-side
 * confirmation existed. Fresh databases already have these columns, so each
 * step is a no-op there. `user_version` makes the backfill run only once.
 */
function migrate(database: Database.Database): void {
  const row = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (row.user_version >= 1) return;

  addColumn(database, "groups", "require_confirmation", "INTEGER NOT NULL DEFAULT 1");
  addColumn(database, "group_members", "status", "TEXT NOT NULL DEFAULT 'active'");
  addColumn(database, "group_members", "invited_by", "TEXT");
  addColumn(database, "expenses", "created_by", "TEXT");
  addColumn(database, "expenses", "status", "TEXT NOT NULL DEFAULT 'confirmed'");
  addColumn(database, "expenses", "resolved_at", "INTEGER");

  // Existing expenses were entered by their payer and are already on the ledger.
  database.exec("UPDATE expenses SET created_by = paid_by WHERE created_by IS NULL");

  // People who already share a group are treated as connected, so nothing that
  // worked before stops working after the upgrade.
  const now = Date.now();
  const pairs = database
    .prepare(
      `SELECT DISTINCT MIN(a.user_id, b.user_id) AS x, MAX(a.user_id, b.user_id) AS y
       FROM group_members a JOIN group_members b
         ON a.group_id = b.group_id AND a.user_id <> b.user_id`,
    )
    .all() as Array<{ x: string; y: string }>;
  const insert = database.prepare(
    `INSERT INTO connections (id, requester_id, addressee_id, status, created_at, responded_at)
     VALUES (?, ?, ?, 'accepted', ?, ?)`,
  );
  const exists = database.prepare(
    `SELECT 1 FROM connections
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
  );
  for (const { x, y } of pairs) {
    if (!exists.get(x, y, y, x)) {
      insert.run(`con_${crypto.randomUUID()}`, x, y, now, now);
    }
  }
  database.pragma("user_version = 1");
}

function createDatabase(): Database.Database {
  const dbPath =
    process.env.VANTAGE_DB_PATH ??
    path.join(process.cwd(), "data", "vantage.db");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);
  database.pragma("busy_timeout = 15000");
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  database.exec(fs.readFileSync(schemaPath, "utf8"));
  migrate(database);

  // Build workers can initialise concurrently. Take a write lock before the
  // seed check so only one process seeds the demo workspace.
  const seedIfEmpty = database.transaction(() => {
    const { n } = database
      .prepare("SELECT COUNT(*) AS n FROM users")
      .get() as { n: number };
    if (n === 0) seedDatabase(database);
  });
  seedIfEmpty.immediate();

  return database;
}

export const db: Database.Database =
  globalThis.__vantageDb ?? (globalThis.__vantageDb = createDatabase());
