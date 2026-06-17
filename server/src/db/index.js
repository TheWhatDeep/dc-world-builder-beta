import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.assetsDir, { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Lightweight migration runner: applies any .sql files in migrations/ not yet recorded.
export function migrate() {
  const d = getDb();
  d.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);
  const applied = new Set(d.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const record = d.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const tx = d.transaction(() => {
      d.exec(sql);
      record.run(file, Date.now());
    });
    tx();
    count++;
  }
  return { applied: count, total: files.length };
}
