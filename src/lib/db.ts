import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedDatabase } from "./seed";

declare global {
  // eslint-disable-next-line no-var
  var __vantageDb: Database.Database | undefined;
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
