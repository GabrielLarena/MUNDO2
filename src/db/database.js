import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('database.sqlite');

// Ensure info table exists and stores schema version
function initInfoTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const row = db.prepare(`SELECT * FROM info WHERE id = 1`).get();

  if (!row) {
    db.prepare(`
      INSERT INTO info (id, schema_version, updated_at) VALUES (1, '0.0.0', datetime('now'))
    `).run();
  }
}

// Compare versions (simple semantic version comparison)
function versionCompare(v1, v2) {
  const toNums = v => v.split('.').map(Number);
  const [a1, b1, c1] = toNums(v1);
  const [a2, b2, c2] = toNums(v2);

  if (a1 !== a2) return a1 - a2;
  if (b1 !== b2) return b1 - b2;
  return c1 - c2;
}

const migrations = [
/*
  {
    version: '1.0.0',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);
    }
  },
  {
    version: '1.1.0',
    up: () => {
      db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    }
  }
*/
];

function getCurrentVersion() {
  const row = db.prepare(`SELECT schema_version FROM info WHERE id = 1`).get();
  return row?.schema_version || '0.0.0';
}

function setVersion(version) {
  db.prepare(`
    UPDATE info SET schema_version = ?, updated_at = datetime('now') WHERE id = 1
  `).run(version);
}

export function migrate() {
  initInfoTable();

  let currentVersion = getCurrentVersion();

  for (const { version, up } of migrations) {
    if (versionCompare(version, currentVersion) > 0) {
      console.log(`Migrando para versão ${version}...`);
      up();
      setVersion(version);
      currentVersion = version;
    }
  }

  console.log(`Migração concluída para a versão: ${currentVersion}`);
}

export { db };
