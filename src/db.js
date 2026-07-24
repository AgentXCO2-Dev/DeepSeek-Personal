import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { config } from './config.js';

let db;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: config.dbPath,
      driver: sqlite3.Database
    });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        google_id TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        custom_prompt TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Database initialized');
  }
  return db;
}

// User operations
export async function findUserByEmail(email) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE email = ?', email);
}

export async function findUserByGoogleId(googleId) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE google_id = ?', googleId);
}

export async function findUserById(id) {
  const db = await getDb();
  return db.get('SELECT id, email, display_name, created_at FROM users WHERE id = ?', id);
}

export async function createUser(email, passwordHash, displayName) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
    email, passwordHash, displayName || email
  );
  return result.lastID;
}

export async function createUserWithGoogle(googleId, email, displayName) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO users (google_id, email, display_name) VALUES (?, ?, ?)',
    googleId, email, displayName || email
  );
  return result.lastID;
}

export async function getCustomPrompt(userId) {
  const db = await getDb();
  const row = await db.get('SELECT custom_prompt FROM user_settings WHERE user_id = ?', userId);
  return row?.custom_prompt || null;
}

export async function setCustomPrompt(userId, prompt) {
  const db = await getDb();
  await db.run(
    `INSERT INTO user_settings (user_id, custom_prompt) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET custom_prompt = ?`,
    userId, prompt, prompt
  );
}
