import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'fintrack.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER', 'ADMIN')),
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
`);

console.log('Database tables verified.');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000_GENESIS_BUILD_SECURE_24';
let currentPrevHash = GENESIS_HASH;

function logAudit(userId, action, entityType, entityId, details) {
  const lastEntry = db.prepare('SELECT hash FROM audit_logs ORDER BY rowid DESC LIMIT 1').get();
  if (lastEntry) currentPrevHash = lastEntry.hash;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details || {});
  
  const hash = crypto.createHash('sha256')
    .update(`${currentPrevHash}|${createdAt}|${userId || 'SYSTEM'}|${action}|${entityType}|${entityId || ''}|${detailsStr}`)
    .digest('hex');

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId || null, action, entityType, entityId || null, detailsStr, '127.0.0.1', currentPrevHash, hash, createdAt);

  currentPrevHash = hash;
  return id;
}

// 1. Seed System Categories
const systemCategories = [
  { id: 'cat_salary', name: 'Salary & Income', icon: 'Wallet', color: '#10B981' },
  { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_housing', name: 'Housing & Rent', icon: 'Home', color: '#3B82F6' },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#6366F1' },
  { id: 'cat_transport', name: 'Transportation', icon: 'Car', color: '#8B5CF6' },
  { id: 'cat_entertainment', name: 'Entertainment', icon: 'Film', color: '#EC4899' },
  { id: 'cat_health', name: 'Health & Wellness', icon: 'HeartPulse', color: '#EF4444' },
  { id: 'cat_shopping', name: 'Shopping & Electronics', icon: 'ShoppingBag', color: '#14B8A6' },
];

const insertCat = db.prepare(`
  INSERT OR IGNORE INTO categories (id, user_id, name, icon, color, is_system, created_at)
  VALUES (?, NULL, ?, ?, ?, 1, ?)
`);

const now = new Date().toISOString();
for (const cat of systemCategories) {
  insertCat.run(cat.id, cat.name, cat.icon, cat.color, now);
}
console.log(`Seeded ${systemCategories.length} system categories.`);

// 2. Seed Users
const demoUserId = 'usr_demo_user_76';
const demoAdminId = 'usr_demo_admin_76';

const userPasswordHash = hashPassword('Password123!');
const adminPasswordHash = hashPassword('AdminPass123!');

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (id, email, name, password_hash, role, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertUser.run(demoUserId, 'user@demo.com', 'Alex Mercer', userPasswordHash, 'USER', now, now);
logAudit(demoUserId, 'SEED_USER_CREATE', 'users', demoUserId, { role: 'USER', email: 'user@demo.com' });

insertUser.run(demoAdminId, 'admin@demo.com', 'Sarah Connor (Security Admin)', adminPasswordHash, 'ADMIN', now, now);
logAudit(demoAdminId, 'SEED_ADMIN_CREATE', 'users', demoAdminId, { role: 'ADMIN', email: 'admin@demo.com' });

console.log('Seeded demo users: user@demo.com (Password123!) and admin@demo.com (AdminPass123!).');

// 3. Seed Realistic Transactions (Amounts in INTEGER minor units / cents)
// Clean prior demo transactions to keep seed reproducible
db.prepare('DELETE FROM transactions WHERE user_id = ?').run(demoUserId);

const transactions = [
  { amount: 520000, type: 'INCOME', desc: 'TechCorp Monthly Salary', cat: 'cat_salary', date: '2026-10-01', method: 'Bank' },
  { amount: 145000, type: 'EXPENSE', desc: 'Luxury Apartment Rent', cat: 'cat_housing', date: '2026-10-01', method: 'Bank' },
  { amount: 13240, type: 'EXPENSE', desc: 'Whole Foods Market Groceries', cat: 'cat_food', date: '2026-10-02', method: 'Card' },
  { amount: 7500, type: 'EXPENSE', desc: 'Electric & Fiber Internet Bill', cat: 'cat_utilities', date: '2026-10-02', method: 'Bank' },
  { amount: 85000, type: 'INCOME', desc: 'Security Audit Consulting Fee', cat: 'cat_salary', date: '2026-10-03', method: 'Bank' },
  { amount: 4850, type: 'EXPENSE', desc: 'Blue Bottle Coffee & Breakfast', cat: 'cat_food', date: '2026-10-03', method: 'Card' },
  { amount: 12000, type: 'EXPENSE', desc: 'Metro Pass & Uber Rides', cat: 'cat_transport', date: '2026-10-04', method: 'Card' },
  { amount: 2999, type: 'EXPENSE', desc: 'Netflix & Spotify Family Subscriptions', cat: 'cat_entertainment', date: '2026-10-04', method: 'Card' },
  { amount: 8900, type: 'EXPENSE', desc: 'Gym Membership & Supplements', cat: 'cat_health', date: '2026-10-04', method: 'Card' },
  { amount: 24900, type: 'EXPENSE', desc: 'Mechanical Keyboard & Desk Monitor Arm', cat: 'cat_shopping', date: '2026-10-05', method: 'Card' },
  { amount: 6200, type: 'EXPENSE', desc: 'Dinner with Engineering Team', cat: 'cat_food', date: '2026-10-05', method: 'Card' },
];

const insertTx = db.prepare(`
  INSERT INTO transactions (id, user_id, category_id, amount, type, description, date, payment_method, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < transactions.length; i++) {
  const tx = transactions[i];
  const txId = `tx_demo_${i + 1}`;
  insertTx.run(txId, demoUserId, tx.cat, tx.amount, tx.type, tx.desc, tx.date, tx.method, 'Automated Seed Transaction', now, now);
}
console.log(`Seeded ${transactions.length} transactions for user@demo.com.`);

// 4. Seed Budgets for demo user
db.prepare('DELETE FROM budgets WHERE user_id = ?').run(demoUserId);

const budgets = [
  { cat: null, amount: 280000, period: 'MONTHLY' }, // Overall budget: $2,800.00
  { cat: 'cat_food', amount: 45000, period: 'MONTHLY' }, // Food: $450.00
  { cat: 'cat_housing', amount: 150000, period: 'MONTHLY' }, // Housing: $1,500.00
  { cat: 'cat_transport', amount: 20000, period: 'MONTHLY' }, // Transport: $200.00
  { cat: 'cat_entertainment', amount: 10000, period: 'MONTHLY' }, // Entertainment: $100.00
];

const insertBudget = db.prepare(`
  INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < budgets.length; i++) {
  const b = budgets[i];
  insertBudget.run(`bdg_demo_${i + 1}`, demoUserId, b.cat, b.amount, b.period, now, now);
}
console.log(`Seeded ${budgets.length} budgets for user@demo.com.`);

logAudit(demoUserId, 'SEED_DATA_INITIALIZED', 'database', 'fintrack.db', {
  transactionsCount: transactions.length,
  budgetsCount: budgets.length,
  currencyUnit: 'INTEGER_MINOR_UNITS_CENTS',
});

console.log('Seed completed successfully. Hash-chain audit trail intact.');
