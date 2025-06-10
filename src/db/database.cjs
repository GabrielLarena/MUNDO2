const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

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

// Simple semantic version comparison
function versionCompare(v1, v2) {
  const toNums = v => v.split('.').map(Number);
  const [a1 = 0, b1 = 0, c1 = 0] = toNums(v1);
  const [a2 = 0, b2 = 0, c2 = 0] = toNums(v2);

  if (a1 !== a2) return a1 - a2;
  if (b1 !== b2) return b1 - b2;
  return c1 - c2;
}

function getCurrentVersion() {
  const row = db.prepare(`SELECT schema_version FROM info WHERE id = 1`).get();
  return row?.schema_version || '0.0.0';
}

function setVersion(version) {
  db.prepare(`
    UPDATE info SET schema_version = ?, updated_at = datetime('now') WHERE id = 1
  `).run(version);
}

function getMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir);
    const migrationFiles = files
        .filter(file => file.endsWith('.up.sql'))
        .map(file => {
            // Extract version from filename like '001_..._up.sql' or '1.0.0_..._up.sql'
            const versionMatch = file.match(/^(\d{1,3}(?:\.\d{1,3}){0,2})/);
            if (!versionMatch) {
                console.warn(`Skipping migration file with invalid name format: ${file}`);
                return null;
            }
            const version = versionMatch[1].replace(/^(0{1,2})/, ''); // remove leading zeros for semver
            const upPath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(upPath, 'utf-8');
            return { version, sql };
        })
        .filter(Boolean); // Remove nulls

    // Sort migrations by version
    return migrationFiles.sort((a, b) => versionCompare(a.version, b.version));
}


function migrate() {
  initInfoTable();
  let currentVersion = getCurrentVersion();
  const migrations = getMigrations();

  console.log(`Current database version: ${currentVersion}`);

  for (const { version, sql } of migrations) {
    if (versionCompare(version, currentVersion) > 0) {
      console.log(`Migrating to version ${version}...`);
      try {
        db.exec(sql);
        setVersion(version);
        currentVersion = version;
        console.log(`Successfully migrated to version ${version}.`);
      } catch (err) {
        console.error(`Failed to migrate to version ${version}:`, err);
        // Since we are in a transaction, the changes (including setVersion) should be rolled back.
        // We stop the migration process immediately on failure.
        throw new Error(`Migration failed at version ${version}.`);
      }
    }
  }

  console.log(`Database is up to date at version: ${currentVersion}`);
}

module.exports = { db, migrate };
