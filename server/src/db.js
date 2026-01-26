import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const schema = `
CREATE TABLE IF NOT EXISTS exhibitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT NOT NULL,
  checkin_time TEXT NOT NULL,
  FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
);

CREATE TABLE IF NOT EXISTS draw_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  draw_time TEXT NOT NULL,
  result TEXT NOT NULL,
  is_win INTEGER NOT NULL,
  FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

db.exec(schema);

const ensureDefaults = () => {
  const exhibitionCount = db.prepare("SELECT COUNT(*) AS count FROM exhibitions").get();
  if (exhibitionCount.count === 0) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO exhibitions (name, created_at, is_active) VALUES (?, ?, 1)").run("默认展会", now);
  }

  const settingsCount = db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key = ?").get("draw");
  if (settingsCount.count === 0) {
    const defaultValue = JSON.stringify({ winRate: 0.3, prizes: [] });
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("draw", defaultValue);
  }
};

ensureDefaults();

export default db;
