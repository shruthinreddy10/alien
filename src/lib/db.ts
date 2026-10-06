import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    const dir = path.dirname(process.env.DATABASE_PATH);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    return process.env.DATABASE_PATH;
  }

  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    const tmpPath = path.join(os.tmpdir(), 'fintrack.db');
    const bundledPath = path.join(process.cwd(), 'data', 'fintrack.db');
    if (!fs.existsSync(tmpPath) && fs.existsSync(bundledPath)) {
      try {
        fs.copyFileSync(bundledPath, tmpPath);
      } catch (e) {
        console.warn('Could not copy bundled db to tmp:', e);
      }
    }
    return tmpPath;
  }

  const localDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'fintrack.db');
  } catch (err) {
    console.warn('Read-only local directory, falling back to os.tmpdir():', err);
    return path.join(os.tmpdir(), 'fintrack.db');
  }
}

// Singleton database connection
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = getDatabasePath();
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initSchema(dbInstance);
    seedBaselineIfNeeded(dbInstance);
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

    -- Demo Cards (PCI-DSS compliant: Tokenized, never stores full PAN or CVV)
    CREATE TABLE IF NOT EXISTS demo_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL CHECK(brand IN ('VISA', 'MASTERCARD', 'AMEX', 'RUPAY')),
      last4 TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      expiry_month INTEGER NOT NULL,
      expiry_year INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_demo_cards_user ON demo_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_demo_cards_token ON demo_cards(token);

    -- Webhook Events (Idempotency & Replay Protection)
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      signature TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE')),
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_events_ref ON webhook_events(reference);
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
  try { db.exec(`ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL', 'RECURRING', 'CSV_IMPORT', 'CARD_WEBHOOK', 'AI_SUGGESTED'));`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN card_id TEXT REFERENCES demo_cards(id) ON DELETE SET NULL;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN card_last4 TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN webhook_ref TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN level TEXT DEFAULT 'MEDIUM';`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN title TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN description TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN metadata TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN attachment_url TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN attachmentUrl TEXT;`); } catch (_) {}

  // Ensure default Uncategorized system category exists
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, is_system, created_at)
      VALUES ('cat_uncategorized', NULL, 'Uncategorized', 'HelpCircle', '#64748B', 1, ?)
    `).run(now);
  } catch (_) {}
}

function hashPasswordInternal(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function seedBaselineIfNeeded(db: DatabaseSync) {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number } | undefined;
    if (userCount && userCount.count > 0) {
      return; // Already seeded
    }

    const nowIso = new Date().toISOString();
    const demoUserId = 'usr_demo_user_76';
    const demoAdminId = 'usr_demo_admin_76';

    const userPass = hashPasswordInternal('Password123!');
    const adminPass = hashPasswordInternal('AdminPass123!');

    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, password_hash, role, status, two_factor_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
    `);
    insertUser.run(demoUserId, 'user@demo.com', 'Shruthin Reddy', userPass, 'USER', '2026-05-01T00:00:00Z', nowIso);
    insertUser.run(demoAdminId, 'admin@demo.com', 'Sarah Connor (Security Admin)', adminPass, 'ADMIN', '2026-05-01T00:00:00Z', nowIso);

    // Categories
    const categories = [
      { id: 'cat_salary', name: 'Salary & Income', icon: 'Wallet', color: '#10B981', is_system: 1 },
      { id: 'cat_freelance', name: 'Freelance & Consulting', icon: 'Coins', color: '#059669', is_system: 1 },
      { id: 'cat_housing', name: 'Rent & Housing', icon: 'Home', color: '#3B82F6', is_system: 1 },
      { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#F59E0B', is_system: 1 },
      { id: 'cat_groceries', name: 'Groceries & Mart', icon: 'ShoppingBag', color: '#10B981', is_system: 1 },
      { id: 'cat_transport', name: 'Transport & Auto', icon: 'Car', color: '#8B5CF6', is_system: 1 },
      { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#6366F1', is_system: 1 },
      { id: 'cat_entertainment', name: 'Entertainment & Movies', icon: 'Film', color: '#EC4899', is_system: 1 },
      { id: 'cat_shopping', name: 'Shopping & Retail', icon: 'ShoppingBag', color: '#EC4899', is_system: 1 },
      { id: 'cat_health', name: 'Health & Medical', icon: 'Heart', color: '#EF4444', is_system: 1 },
      { id: 'cat_investments', name: 'Investments & SIP', icon: 'TrendingUp', color: '#10B981', is_system: 1 },
      { id: 'cat_subscriptions', name: 'Subscriptions', icon: 'CreditCard', color: '#6366F1', is_system: 1 },
      { id: 'cat_misc', name: 'General & Misc', icon: 'MoreHorizontal', color: '#64748B', is_system: 1 },
      { id: 'cat_custom_coffee', name: 'Coffee', icon: 'Coffee', color: '#D97706', is_system: 0 },
      { id: 'cat_custom_pet', name: 'Pet Care', icon: 'Heart', color: '#10B981', is_system: 0 },
      { id: 'cat_custom_gaming', name: 'Gaming', icon: 'Gamepad2', color: '#8B5CF6', is_system: 0 },
    ];

    const insertCat = db.prepare(`
      INSERT OR REPLACE INTO categories (id, user_id, name, icon, color, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of categories) {
      insertCat.run(c.id, c.is_system ? null : demoUserId, c.name, c.icon, c.color, c.is_system, nowIso);
    }

    // Seed sample transactions
    const insertTx = db.prepare(`
      INSERT OR REPLACE INTO transactions (id, user_id, category_id, amount, type, description, date, payment_method, notes, tags, receipt_key, is_recurring, recurrence_rule, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTx.run('tx_seed_1', demoUserId, 'cat_salary', 8500000, 'INCOME', 'Salary Credit - Tech Innovations Ltd', '2026-10-01', 'Net Banking', 'Monthly corporate payroll direct deposit', JSON.stringify(['salary']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run('tx_seed_2', demoUserId, 'cat_housing', 2800000, 'EXPENSE', 'HDFC Home Rent Transfer', '2026-10-02', 'Net Banking', 'Flat 402, Green Glen Layout', JSON.stringify(['rent']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run('tx_seed_3', demoUserId, 'cat_food', 124000, 'EXPENSE', 'Swiggy Gourmet Order #98124', '2026-10-03', 'UPI', 'Meghana Biryani with friends', JSON.stringify(['food']), null, 0, null, nowIso, nowIso);
    insertTx.run('tx_seed_4', demoUserId, 'cat_groceries', 342000, 'EXPENSE', 'BigBasket Weekly Groceries', '2026-10-04', 'Card', 'Fruits, vegetables, dairy staples', JSON.stringify(['groceries']), null, 0, null, nowIso, nowIso);
    insertTx.run('tx_seed_5', demoUserId, 'cat_custom_coffee', 45000, 'EXPENSE', 'Starbucks India Espresso Roast', '2026-10-05', 'UPI', 'Morning latte', JSON.stringify(['coffee']), null, 0, null, nowIso, nowIso);

    // Seed sample pending inbox notifications
    const insertInbox = db.prepare(`
      INSERT OR REPLACE INTO inbox_notifications (
        id, user_id, source, amount_minor, merchant, raw_payload,
        suggested_category_id, confidence, status, received_at, confirmed_at, transaction_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertInbox.run(
      'inbox_seed_1', demoUserId, 'UPI', 54000, 'Swiggy Instant Order',
      JSON.stringify({ type: 'UPI_DEBIT', amount: 54000, merchant: 'Swiggy', ref: 'UPI/2026/89123' }),
      'cat_food', 'HIGH', 'PENDING', new Date(Date.now() - 3600000).toISOString(), null, null, nowIso
    );
    insertInbox.run(
      'inbox_seed_2', demoUserId, 'CARD', 189000, 'DMart Supermarket',
      JSON.stringify({ type: 'CARD_ALERT', amount: 189000, merchant: 'DMart Supermarket', last4: '4821' }),
      'cat_groceries', 'HIGH', 'PENDING', new Date(Date.now() - 7200000).toISOString(), null, null, nowIso
    );
    insertInbox.run(
      'inbox_seed_3', demoUserId, 'EMAIL', 78900, 'IRCTC Express Reservation',
      JSON.stringify({ type: 'EMAIL_RECEIPT', amount: 78900, merchant: 'IRCTC Express Reservation', pnr: '421980312' }),
      'cat_transport', 'HIGH', 'PENDING', new Date(Date.now() - 14400000).toISOString(), null, null, nowIso
    );
    insertInbox.run(
      'inbox_seed_4', demoUserId, 'UPI', 28000, 'Blue Tokai Coffee Roasters',
      JSON.stringify({ type: 'UPI_DEBIT', amount: 28000, merchant: 'Blue Tokai Coffee Roasters', ref: 'UPI/2026/41029' }),
      'cat_custom_coffee', 'HIGH', 'PENDING', new Date(Date.now() - 28800000).toISOString(), null, null, nowIso
    );

    // Seed demo card
    const insertCard = db.prepare(`
      INSERT OR REPLACE INTO demo_cards (
        id, user_id, token, brand, last4, holder_name, expiry_month, expiry_year, nickname, is_active, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    insertCard.run('card_seed_1', demoUserId, 'card_tok_demo_4821', 'VISA', '4821', 'Shruthin Reddy', 12, 2028, 'HDFC Millennia', nowIso, nowIso);

  } catch (err) {
    console.warn('Baseline seeding note:', err);
  }
}
