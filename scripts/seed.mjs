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

// Initialize tables with all required v3 columns
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

  CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_minor INTEGER NOT NULL,
    current_minor INTEGER NOT NULL DEFAULT 0,
    deadline TEXT,
    created_at TEXT NOT NULL
  );

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

  CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

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
`);

try { db.exec(`ALTER TABLE transactions ADD COLUMN deleted_at TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN level TEXT DEFAULT 'MEDIUM';`); } catch (_) {}
try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN title TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN description TEXT;`); } catch (_) {}
try { db.exec(`ALTER TABLE anomaly_alerts ADD COLUMN metadata TEXT;`); } catch (_) {}

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

// 1. Categories
const categories = [
  { id: 'cat_salary', name: 'Salary & Income', icon: 'Wallet', color: '#10B981' },
  { id: 'cat_freelance', name: 'Freelance & Consulting', icon: 'Coins', color: '#059669' },
  { id: 'cat_housing', name: 'Housing & Rent', icon: 'Home', color: '#3B82F6' },
  { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_groceries', name: 'Groceries', icon: 'ShoppingBag', color: '#10B981' },
  { id: 'cat_transport', name: 'Transportation', icon: 'Car', color: '#8B5CF6' },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#6366F1' },
  { id: 'cat_entertainment', name: 'Entertainment', icon: 'Film', color: '#EC4899' },
  { id: 'cat_health', name: 'Health & Wellness', icon: 'HeartPulse', color: '#EF4444' },
  { id: 'cat_shopping', name: 'Shopping & Goods', icon: 'Package', color: '#14B8A6' },
  { id: 'cat_subscriptions', name: 'Subscriptions', icon: 'RefreshCw', color: '#A855F7' },
  { id: 'cat_misc', name: 'Miscellaneous', icon: 'HelpCircle', color: '#64748B' },
  { id: 'cat_uncategorized', name: 'Uncategorized', icon: 'HelpCircle', color: '#64748B' },
];

const insertCat = db.prepare(`
  INSERT OR REPLACE INTO categories (id, user_id, name, icon, color, is_system, created_at)
  VALUES (?, NULL, ?, ?, ?, 1, ?)
`);
const nowIso = new Date().toISOString();
for (const cat of categories) {
  insertCat.run(cat.id, cat.name, cat.icon, cat.color, nowIso);
}

// 2. Demo Users
const demoUserId = 'usr_demo_user_76';
const demoAdminId = 'usr_demo_admin_76';

const userPass = hashPassword('Password123!');
const adminPass = hashPassword('AdminPass123!');

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (id, email, name, password_hash, role, status, two_factor_enabled, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
`);
insertUser.run(demoUserId, 'user@demo.com', 'Alex Mercer', userPass, 'USER', '2026-05-01T00:00:00Z', nowIso);
insertUser.run(demoAdminId, 'admin@demo.com', 'Sarah Connor (Security Admin)', adminPass, 'ADMIN', '2026-05-01T00:00:00Z', nowIso);

// 3. 6 Months of Realistic Seed Transactions for Both Users
db.prepare('DELETE FROM transactions').run();
const insertTx = db.prepare(`
  INSERT INTO transactions (id, user_id, category_id, amount, type, description, date, payment_method, notes, tags, receipt_key, is_recurring, recurrence_rule, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Date range: 2026-05-01 to 2026-10-05 (6 months)
const pad = (n) => String(n).padStart(2, '0');
const months = [
  { year: 2026, month: 5, name: '2026-05' },
  { year: 2026, month: 6, name: '2026-06' },
  { year: 2026, month: 7, name: '2026-07' },
  { year: 2026, month: 8, name: '2026-08' },
  { year: 2026, month: 9, name: '2026-09' },
  { year: 2026, month: 10, name: '2026-10' },
];

let globalTxCounter = 1;

for (const uId of [demoUserId, demoAdminId]) {
  for (const m of months) {
    const ym = `${m.year}-${pad(m.month)}`;

    // Monthly recurring income (1st)
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_salary', 520000, 'INCOME', 'TechCorp Monthly Salary', `${ym}-01`, 'Bank', 'Direct Deposit', JSON.stringify(['salary', 'payroll']), null, 1, 'MONTHLY', nowIso, nowIso);
    // Freelance income (15th)
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_freelance', 85000, 'INCOME', 'Consulting & Code Audit', `${ym}-15`, 'Bank', 'Client invoice payment', JSON.stringify(['freelance']), null, 0, null, nowIso, nowIso);

    // Monthly recurring expenses
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_housing', 145000, 'EXPENSE', 'Luxury Apartment Rent', `${ym}-01`, 'Bank', 'Automated ACH Rent', JSON.stringify(['rent', 'fixed']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_subscriptions', 2299, 'EXPENSE', 'Netflix Premium 4K', `${ym}-05`, 'Card', 'Streaming service', JSON.stringify(['subscription', 'netflix']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_subscriptions', 1199, 'EXPENSE', 'Spotify Family Plan', `${ym}-12`, 'Card', 'Music streaming', JSON.stringify(['subscription', 'spotify']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_health', 7500, 'EXPENSE', 'Equinox Fitness Club', `${ym}-15`, 'Card', 'Monthly gym dues', JSON.stringify(['fitness', 'gym']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_utilities', 8400, 'EXPENSE', 'Google Fiber Internet', `${ym}-20`, 'Bank', 'Fiber gigabit internet', JSON.stringify(['utility', 'internet']), null, 1, 'MONTHLY', nowIso, nowIso);
    insertTx.run(`tx_seed_${globalTxCounter++}`, uId, 'cat_utilities', 6250, 'EXPENSE', 'City Power & Light Electric', `${ym}-22`, 'Bank', 'Electricity bill', JSON.stringify(['electric']), null, 1, 'MONTHLY', nowIso, nowIso);

    // Variable expenses spread across days
    const variableExpenses = [
      { day: 2, cat: 'cat_groceries', amount: 12450, desc: 'Whole Foods Market', method: 'Card' },
      { day: 3, cat: 'cat_food', amount: 3450, desc: 'Blue Bottle Coffee', method: 'Card' },
      { day: 4, cat: 'cat_transport', amount: 2800, desc: 'Uber Ride to Airport', method: 'Card' },
      { day: 7, cat: 'cat_food', amount: 6800, desc: 'Chipotle Mexican Grill', method: 'Card' },
      { day: 9, cat: 'cat_groceries', amount: 15300, desc: 'Trader Joe\'s Groceries', method: 'Card' },
      { day: 11, cat: 'cat_shopping', amount: 8900, desc: 'Amazon Prime Order', method: 'Card' },
      { day: 14, cat: 'cat_food', amount: 9200, desc: 'Italian Trattoria Dinner', method: 'Card' },
      { day: 16, cat: 'cat_transport', amount: 4500, desc: 'Shell Gas Station Fill-up', method: 'Card' },
      { day: 18, cat: 'cat_groceries', amount: 11200, desc: 'Whole Foods Market', method: 'Card' },
      { day: 21, cat: 'cat_entertainment', amount: 5500, desc: 'AMC IMAX Movie Tickets', method: 'Card' },
      { day: 24, cat: 'cat_food', amount: 4100, desc: 'Sweetgreen Salad', method: 'Card' },
      { day: 26, cat: 'cat_shopping', amount: 18500, desc: 'Uniqlo Apparel & Basics', method: 'Card' },
      { day: 28, cat: 'cat_misc', amount: 3200, desc: 'CVS Pharmacy Essentials', method: 'Card' },
    ];

    for (const v of variableExpenses) {
      if (m.month === 10 && v.day > 5) continue; // October only goes up to Oct 5
      const dStr = `${ym}-${pad(v.day)}`;
      insertTx.run(`tx_seed_${globalTxCounter++}`, uId, v.cat, v.amount, 'EXPENSE', v.desc, dStr, v.method, 'Regular spending', JSON.stringify([]), null, 0, null, nowIso, nowIso);
    }
  }
}

// 3.5 Custom Categories for user@demo.com per 13.2 specification
const customCategories = [
  { id: 'cat_custom_coffee', name: 'Coffee', icon: 'Coffee', color: '#D97706' },
  { id: 'cat_custom_pet', name: 'Pet Care', icon: 'Heart', color: '#10B981' },
  { id: 'cat_custom_gaming', name: 'Gaming', icon: 'Gamepad2', color: '#8B5CF6' },
];

const insertCustomCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (id, user_id, name, icon, color, is_system, created_at)
  VALUES (?, ?, ?, ?, ?, 0, ?)
`);
for (const cc of customCategories) {
  insertCustomCategory.run(cc.id, demoUserId, cc.name, cc.icon, cc.color, nowIso);
}

// Seed 12 Coffee transactions for user@demo.com
const coffeeNames = [
  'Blue Bottle Single Origin', 'Artisan Espresso Bar', 'Starbucks Blonde Roast', 'Philz Mint Mojito Coffee',
  'Cold Brew & Almond Croissant', 'Pour Over Chemex Ethiopia', 'Matcha Latte & Cookie', 'Flat White Cortado',
  'Stumptown Nitro Cold Brew', 'Local Roastery Beans', 'Iced Americano', 'Specialty Drip Coffee'
];
for (let i = 0; i < 12; i++) {
  const dStr = `2026-09-${pad((i % 28) + 1)}`;
  insertTx.run(`tx_seed_coffee_${i}`, demoUserId, 'cat_custom_coffee', 450 + (i * 30), 'EXPENSE', coffeeNames[i], dStr, 'Card', 'Coffee routine', JSON.stringify([]), null, 0, null, nowIso, nowIso);
}

// Pet Care has 0 transactions seeded

// Seed 28 Gaming transactions for user@demo.com
const gamingNames = [
  'Steam Summer Sale RPG', 'PlayStation Plus Essential', 'Nintendo eShop Indie Title', 'Discord Nitro Annual',
  'Xbox Game Pass Ultimate', 'Twitch Creator Subscription', 'Cyberpunk DLC Expansion', 'Elden Ring Shadow of Erdtree',
  'Mechanical Gaming Keycaps', 'Steam Deck OLED Case', 'Humble Bundle Choice', 'GOG Classic Collection',
  'Razer Mousepad & Grips', 'Battle Pass Season 4', 'Valve CS2 Prime Upgrade', 'Epic Games Weekly Special',
  'Final Fantasy XIV Sub', 'Factorio Space Age', 'Hollow Knight Silksong Preorder', 'RetroArch Controller Adapter',
  'Origin EA Play Monthly', 'Ubisoft+ Classics', 'Blizzard Battle.net Token', 'GeForce NOW Priority Tier',
  'Sony DualSense Charging Dock', 'Capcom Monster Hunter Wilds', 'Steam Workshop Asset Pack', 'Itch.io Creator Bundle'
];
for (let i = 0; i < 28; i++) {
  const mIdx = (i % 5) + 5;
  const day = (i % 25) + 1;
  const dStr = `2026-${pad(mIdx)}-${pad(day)}`;
  insertTx.run(`tx_seed_gaming_${i}`, demoUserId, 'cat_custom_gaming', 1999 + (i * 250), 'EXPENSE', gamingNames[i], dStr, 'Card', 'Gaming hobby', JSON.stringify([]), null, 0, null, nowIso, nowIso);
}

// Seed the 2 specific anomaly transactions per 13.1 specification
// 1. ₹1,200 Starbucks (3x Food & Dining avg)
const txStarbucksId = 'tx_seed_starbucks_spike';
insertTx.run(txStarbucksId, demoUserId, 'cat_food', 120000, 'EXPENSE', 'Starbucks Reserve Tasting', '2026-10-04', 'Card', 'Unusual high spend', JSON.stringify(['flagged']), null, 0, null, nowIso, nowIso);

// 2. Netflix charged twice on same day (2026-10-04)
const txNetflix1 = 'tx_seed_netflix_dup1';
const txNetflix2 = 'tx_seed_netflix_dup2';
insertTx.run(txNetflix1, demoUserId, 'cat_subscriptions', 2299, 'EXPENSE', 'Netflix Premium', '2026-10-04', 'Card', 'Monthly charge 1', JSON.stringify([]), null, 0, null, nowIso, nowIso);
insertTx.run(txNetflix2, demoUserId, 'cat_subscriptions', 2299, 'EXPENSE', 'Netflix Premium', '2026-10-04', 'Card', 'Accidental duplicate charge', JSON.stringify([]), null, 0, null, nowIso, nowIso);

// 4. Budgets for user@demo.com (including Gaming budget per 13.2 specification)
db.prepare('DELETE FROM budgets').run();
const insertBudget = db.prepare(`
  INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertBudget.run('bdg_user_overall', demoUserId, null, 280000, 'MONTHLY', nowIso, nowIso);
insertBudget.run('bdg_user_housing', demoUserId, 'cat_housing', 150000, 'MONTHLY', nowIso, nowIso);
insertBudget.run('bdg_user_food', demoUserId, 'cat_food', 30000, 'MONTHLY', nowIso, nowIso);
insertBudget.run('bdg_user_ent', demoUserId, 'cat_entertainment', 5000, 'MONTHLY', nowIso, nowIso);
insertBudget.run('bdg_user_gaming', demoUserId, 'cat_custom_gaming', 500000, 'MONTHLY', nowIso, nowIso); // ₹5,000/mo Gaming budget

// 5. Detected Subscriptions
db.prepare('DELETE FROM subscriptions').run();
const insertSub = db.prepare(`
  INSERT INTO subscriptions (id, user_id, merchant, amount_minor, cadence, next_charge_at, dismissed, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSub.run('sub_1', demoUserId, 'Netflix Premium', 2299, 'MONTHLY', '2026-11-05', 0, nowIso);
insertSub.run('sub_2', demoUserId, 'Spotify Family', 1199, 'MONTHLY', '2026-11-12', 0, nowIso);
insertSub.run('sub_3', demoUserId, 'Equinox Gym', 7500, 'MONTHLY', '2026-11-15', 0, nowIso);
insertSub.run('sub_4', demoUserId, 'Google Fiber', 8400, 'MONTHLY', '2026-11-20', 0, nowIso);

// 6. Savings Goals
db.prepare('DELETE FROM savings_goals').run();
const insertGoal = db.prepare(`
  INSERT INTO savings_goals (id, user_id, name, target_minor, current_minor, deadline, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertGoal.run('goal_1', demoUserId, 'Emergency Fund (6 Months)', 2000000, 1600000, '2026-12-31', nowIso);
insertGoal.run('goal_2', demoUserId, 'Tokyo Autumn Trip', 500000, 375000, '2027-04-15', nowIso);
insertGoal.run('goal_3', demoUserId, 'MacBook Pro M4 Max', 350000, 120000, '2026-11-30', nowIso);

// 7. Recurring Rules
db.prepare('DELETE FROM recurring_rules').run();
const insertRec = db.prepare(`
  INSERT INTO recurring_rules (id, user_id, merchant, amount_minor, category_id, cadence, next_run_at, paused, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertRec.run('rec_1', demoUserId, 'Luxury Apartment Rent', 145000, 'cat_housing', 'MONTHLY', '2026-11-01', 0, nowIso);
insertRec.run('rec_2', demoUserId, 'Equinox Gym', 7500, 'cat_health', 'MONTHLY', '2026-11-15', 0, nowIso);
insertRec.run('rec_3', demoUserId, 'Google Fiber Internet', 8400, 'cat_utilities', 'MONTHLY', '2026-11-20', 0, nowIso);

// 8. Anomaly Alerts (2 seeded unacknowledged anomalies for user@demo.com per 13.1 specification)
db.exec('DROP TABLE IF EXISTS anomaly_alerts;');
db.exec(`
  CREATE TABLE anomaly_alerts (
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
`);
const insertAnomaly = db.prepare(`
  INSERT INTO anomaly_alerts (id, user_id, transaction_id, rule, severity, level, title, description, metadata, details, acknowledged_at, dismissed_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertAnomaly.run(
  'anom_starbucks',
  demoUserId,
  txStarbucksId,
  'amount_outlier',
  0.85,
  'HIGH',
  'Unusual High Spend at Starbucks',
  'Transaction amount ₹1,200 (₹1,200.00) is 3x higher than your Food & Dining 90-day average.',
  JSON.stringify({ amount: 120000, categoryAvg: 40000, multiplier: 3.0, merchant: 'Starbucks Reserve' }),
  'Transaction amount ₹1,200 (₹1,200.00) is 3x higher than your Food & Dining 90-day average.',
  null,
  null,
  nowIso
);

insertAnomaly.run(
  'anom_netflix_dup',
  demoUserId,
  txNetflix2,
  'duplicate_charge',
  0.65,
  'MEDIUM',
  'Potential Duplicate Netflix Charge',
  'Detected identical ₹2,299 charge within 24 hours from Netflix.',
  JSON.stringify({ amount: 2299, duplicateTxId: txNetflix1, merchant: 'Netflix Premium' }),
  'Detected identical ₹2,299 charge within 24 hours from Netflix.',
  null,
  null,
  nowIso
);

// 9. Feature Flags (1 disabled to demonstrate toggling)
db.prepare('DELETE FROM feature_flags').run();
const insertFlag = db.prepare(`
  INSERT INTO feature_flags (id, key, name, description, enabled, last_modified_by, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertFlag.run('flag_1', 'enable_subscriptions', 'Subscription Detector', 'Autonomous 90-day subscription cadence analysis engine.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_2', 'enable_anomalies', 'Anomaly Detection Engine', 'Heuristic outlier monitoring for rapid fraud identification.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_3', 'enforce_2fa_global', 'Global 2FA Enforcement', 'Mandate time-based two-factor authentication for all logins.', 0, 'admin@demo.com', nowIso);
insertFlag.run('flag_4', 'enable_recurring_cron', 'Recurring Transaction Cron', 'Daily background scheduler for automatic transaction ledger creation.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_5', 'enable_ai_demo_mode', 'AI Local Mock Engine', 'Deterministic local LLM mock fallback when external keys are unconfigured.', 1, 'admin@demo.com', nowIso);

// 10. Login Attempts (for Security Dashboard)
db.prepare('DELETE FROM login_attempts').run();
const insertLogin = db.prepare(`
  INSERT INTO login_attempts (id, email, ip_address, status, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
insertLogin.run('log_1', 'admin@demo.com', '192.168.1.104', 'BAD_PASSWORD', '2026-10-04T18:22:10Z');
insertLogin.run('log_2', 'admin@demo.com', '192.168.1.104', 'BAD_PASSWORD', '2026-10-04T18:22:45Z');
insertLogin.run('log_3', 'admin@demo.com', '192.168.1.104', 'BAD_PASSWORD', '2026-10-04T18:23:15Z');
insertLogin.run('log_4', 'unknown@attacker.xyz', '45.33.32.156', 'USER_NOT_FOUND', '2026-10-05T02:11:00Z');
insertLogin.run('log_5', 'admin@demo.com', '127.0.0.1', 'SUCCESS', '2026-10-05T09:00:00Z');
insertLogin.run('log_6', 'user@demo.com', '127.0.0.1', 'SUCCESS', '2026-10-05T09:05:00Z');

// 11. IP Blocklist
db.prepare('DELETE FROM ip_blocklist').run();
const insertBlock = db.prepare(`
  INSERT INTO ip_blocklist (id, ip, reason, added_by, added_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertBlock.run('blk_1', '45.33.32.156', 'Automated brute-force credential stuffing attempt detected.', 'SYSTEM_RATE_LIMITER', '2026-10-05T02:15:00Z', null);

// 12. Active Sessions
db.prepare('DELETE FROM user_sessions').run();
const insertSession = db.prepare(`
  INSERT INTO user_sessions (id, user_id, token_hash, device_label, ip_address, location, last_seen, created_at, revoked_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSession.run('sess_user_active', demoUserId, 'hash_curr_user', 'Chrome 129 on Windows 11', '127.0.0.1', 'Hyderabad, IN', nowIso, '2026-10-05T08:00:00Z', null);
insertSession.run('sess_user_mobile', demoUserId, 'hash_old_mobile', 'Safari on iOS 18 (iPhone 16)', '172.18.10.45', 'Hyderabad, IN', '2026-10-04T22:15:00Z', '2026-10-01T10:00:00Z', null);
insertSession.run('sess_admin_active', demoAdminId, 'hash_curr_admin', 'Brave 1.70 on macOS Sonoma', '127.0.0.1', 'Hyderabad, IN', nowIso, '2026-10-05T08:30:00Z', null);

// 13. Audit logs initialization
logAudit(demoAdminId, 'SEED_DATABASE_EXPANDED', 'system', 'fintrack.db', {
  transactionsCount: globalTxCounter - 1,
  usersCount: 2,
  monthsCovered: 6,
  dateRange: '2026-05-01 to 2026-10-05'
});

console.log(`\n======================================================`);
console.log(`FINTRACK SEED COMPLETE (v3.0)`);
console.log(`Users: user@demo.com / admin@demo.com`);
console.log(`Total transactions created: ${globalTxCounter - 1}`);
console.log(`Covered: 6 months (2026-05-01 to 2026-10-05)`);
console.log(`Budgets: 4 | Subscriptions: 4 | Goals: 3 | Flags: 5`);
console.log(`======================================================\n`);
