import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'fintrack.db');

// Singleton database connection
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function initSchema(db: DatabaseSync) {
  // Base Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER', 'ADMIN')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUSPENDED')),
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_secret TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('openai', 'anthropic', 'gemini')),
      key_ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Card',
      notes TEXT,
      tags TEXT,
      receipt_key TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'MONTHLY' CHECK(period IN ('MONTHLY', 'YEARLY')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, category_id, period)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id, created_at ASC);

    -- =========================================================================
    -- Forward-Only Additions for Feature Expansion v3.0
    -- =========================================================================

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      merchant TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      cadence TEXT NOT NULL DEFAULT 'MONTHLY' CHECK(cadence IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
      next_run_at TEXT NOT NULL,
      paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_rules(user_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      merchant TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      cadence TEXT NOT NULL DEFAULT 'MONTHLY',
      next_charge_at TEXT NOT NULL,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_minor INTEGER NOT NULL,
      current_minor INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id);

    CREATE TABLE IF NOT EXISTS anomaly_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
      rule TEXT NOT NULL,
      severity REAL NOT NULL DEFAULT 0.5,
      level TEXT NOT NULL DEFAULT 'MEDIUM',
      title TEXT,
      description TEXT,
      metadata TEXT,
      details TEXT,
      acknowledged_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_anomalies_user ON anomaly_alerts(user_id);

    CREATE TABLE IF NOT EXISTS feature_flags (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_modified_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ip_blocklist (
      id TEXT PRIMARY KEY,
      ip TEXT UNIQUE NOT NULL,
      reason TEXT NOT NULL,
      added_by TEXT NOT NULL,
      added_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      device_label TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      location TEXT,
      last_seen TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'BAD_PASSWORD', 'USER_NOT_FOUND', 'LOCKED_OUT', 'IP_BLOCKED')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at DESC);

    -- Category Deletion Undo Sessions (30-second window support)
    CREATE TABLE IF NOT EXISTS category_undo_sessions (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      category_data TEXT NOT NULL,
      action TEXT NOT NULL,
      reassigned_to TEXT,
      affected_tx_ids TEXT NOT NULL,
      deleted_budget_data TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cat_undo_user ON category_undo_sessions(user_id, created_at DESC);

    -- Payments Inbox Notifications (Simulated UPI, Card, Email inputs)
    CREATE TABLE IF NOT EXISTS inbox_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK(source IN ('UPI', 'CARD', 'EMAIL')),
      amount_minor INTEGER NOT NULL,
      merchant TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      suggested_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      confidence TEXT NOT NULL DEFAULT 'MED' CHECK(confidence IN ('HIGH', 'MED', 'LOW')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONFIRMED', 'IGNORED')),
      received_at TEXT NOT NULL,
      confirmed_at TEXT,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_user_status ON inbox_notifications(user_id, status, received_at DESC);
  `);

  // Run forward-only column migrations gracefully in case DB already exists
  try { db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUSPENDED'));`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE categories ADD COLUMN parent_id TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN tags TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN receipt_key TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN recurrence_rule TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN deleted_at TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN level TEXT DEFAULT 'MEDIUM';`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN title TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN description TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN metadata TEXT;`); } catch (_) {}

  // Ensure default Uncategorized system category exists
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, is_system, created_at)
      VALUES ('cat_uncategorized', NULL, 'Uncategorized', 'HelpCircle', '#64748B', 1, ?)
    `).run(now);
  } catch (_) {}
}
