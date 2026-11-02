import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type SqliteDatabase = InstanceType<typeof Database>;

const globalForSudokuell = globalThis as typeof globalThis & {
  sudokuellDatabase?: SqliteDatabase;
  sudokuellDatabaseInitialized?: boolean;
};

export function getDatabase(): SqliteDatabase {
  if (globalForSudokuell.sudokuellDatabaseInitialized && globalForSudokuell.sudokuellDatabase) {
    return globalForSudokuell.sudokuellDatabase;
  }

  const configuredPath = process.env.SUDOKUELL_DB_PATH || resolve(process.cwd(), 'data', 'sudokuell.sqlite');
  if (configuredPath !== ':memory:') {
    mkdirSync(dirname(configuredPath), { recursive: true });
  }

  const database = globalForSudokuell.sudokuellDatabase ?? new Database(configuredPath);
  globalForSudokuell.sudokuellDatabase = database;

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      state_json TEXT NOT NULL
    )
  `);

  const rows = database.prepare('SELECT id, state_json FROM matches').all() as
    Array<{ id: string; state_json: string }>;
  const update = database.prepare('UPDATE matches SET state_json = ? WHERE id = ?');
  const recoveredAt = Date.now();

  for (const row of rows) {
    const match = JSON.parse(row.state_json) as {
      players: Record<string, { connected: boolean; disconnectedAt: number | null }>;
    };
    let changed = false;
    for (const player of Object.values(match.players)) {
      if (player.connected) {
        player.connected = false;
        player.disconnectedAt ??= recoveredAt;
        changed = true;
      }
    }
    if (changed) update.run(JSON.stringify(match), row.id);
  }

  globalForSudokuell.sudokuellDatabaseInitialized = true;
  return database;
}
