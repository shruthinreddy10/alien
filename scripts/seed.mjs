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
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    period TEXT NOT NULL DEFAULT 'MONTHLY' CHECK(period IN ('MONTHLY', 'YEARLY')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
`);

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
  
  // SHA-256 hash chaining formula matching security.ts
  const hash = crypto.createHash('sha256')
    .update(`${currentPrevHash}|${createdAt}|${userId || 'ANONYMOUS'}|${action}|${entityType}|${entityId || ''}|${detailsStr}`)
    .digest('hex');

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId || null, action, entityType, entityId || null, detailsStr, '127.0.0.1', currentPrevHash, hash, createdAt);

  currentPrevHash = hash;
  return id;
}

// 1. Categories (Fintech India-specific)
const categories = [
  { id: 'cat_salary', name: 'Salary & Income', icon: 'Wallet', color: '#10B981' },
  { id: 'cat_freelance', name: 'Freelance & Consulting', icon: 'Coins', color: '#059669' },
  { id: 'cat_housing', name: 'Rent & Housing', icon: 'Home', color: '#3B82F6' },
  { id: 'cat_food', name: 'Food & Dining', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_groceries', name: 'Groceries & Mart', icon: 'ShoppingBag', color: '#10B981' },
  { id: 'cat_transport', name: 'Transport & Auto', icon: 'Car', color: '#8B5CF6' },
  { id: 'cat_utilities', name: 'Utilities & Bills', icon: 'Zap', color: '#6366F1' },
  { id: 'cat_entertainment', name: 'Entertainment & Movies', icon: 'Film', color: '#EC4899' },
  { id: 'cat_health', name: 'Health & Pharmacy', icon: 'HeartPulse', color: '#EF4444' },
  { id: 'cat_shopping', name: 'Shopping & E-Commerce', icon: 'Package', color: '#14B8A6' },
  { id: 'cat_subscriptions', name: 'Subscriptions', icon: 'RefreshCw', color: '#A855F7' },
  { id: 'cat_investments', name: 'Investments & SIP', icon: 'TrendingUp', color: '#047857' },
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
insertUser.run(demoUserId, 'user@demo.com', 'Shruthin Reddy', userPass, 'USER', '2026-05-01T00:00:00Z', nowIso);
insertUser.run(demoAdminId, 'admin@demo.com', 'Sarah Connor (Security Admin)', adminPass, 'ADMIN', '2026-05-01T00:00:00Z', nowIso);

// 3. Custom Categories for user@demo.com
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

// 4. 6 Months of Realistic Indian FinTech Transactions for user@demo.com
db.prepare('DELETE FROM transactions').run();
const insertTx = db.prepare(`
  INSERT INTO transactions (id, user_id, category_id, amount, type, description, date, payment_method, notes, tags, receipt_key, is_recurring, recurrence_rule, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

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

for (const m of months) {
  const ym = `${m.year}-${pad(m.month)}`;

  // Salary: ₹85,000 credited on 1st of each month (8500000 paise)
  insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, 'cat_salary', 8500000, 'INCOME', 'Salary Credit - Tech Innovations Ltd', `${ym}-01`, 'Net Banking', 'Monthly corporate payroll direct deposit', JSON.stringify(['salary', 'payroll']), null, 1, 'MONTHLY', nowIso, nowIso);
  
  // Rent: ₹22,000 debited on 5th via UPI (2200000 paise)
  insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, 'cat_housing', 2200000, 'EXPENSE', 'Apartment Rent - Gachibowli', `${ym}-05`, 'UPI', 'UPI to Landlord (HDFC Bank)', JSON.stringify(['rent', 'fixed']), null, 1, 'MONTHLY', nowIso, nowIso);

  // SIP Mutual Fund: ₹5,000 on 10th (500000 paise)
  insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, 'cat_investments', 500000, 'EXPENSE', 'Nippon India Small Cap SIP', `${ym}-10`, 'Net Banking', 'Auto-debit mutual fund SIP investment', JSON.stringify(['sip', 'investment']), null, 1, 'MONTHLY', nowIso, nowIso);

  // Netflix: ₹649 on 12th via Card (64900 paise)
  insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, 'cat_subscriptions', 64900, 'EXPENSE', 'Netflix Premium 4K India', `${ym}-12`, 'Credit Card', 'Monthly streaming subscription', JSON.stringify(['subscription', 'netflix']), null, 1, 'MONTHLY', nowIso, nowIso);

  // Jio Fiber / Mobile: ₹299 on 15th via UPI (29900 paise)
  insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, 'cat_utilities', 29900, 'EXPENSE', 'Jio Postpaid 5G Recharge', `${ym}-15`, 'UPI', 'Monthly mobile data plan', JSON.stringify(['recharge', 'jio']), null, 1, 'MONTHLY', nowIso, nowIso);

  // Indian Lifestyle & Living Variable Expenses
  const variableExpenses = [
    { day: 2, cat: 'cat_groceries', amount: 245000, desc: 'BigBasket Fresh Groceries', method: 'UPI' },
    { day: 3, cat: 'cat_food', amount: 24000, desc: 'Third Wave Coffee - Cortado', method: 'UPI' },
    { day: 4, cat: 'cat_transport', amount: 8500, desc: 'Auto Ride to Metro Station', method: 'UPI' },
    { day: 6, cat: 'cat_food', amount: 34000, desc: 'Swiggy - Biryani & Thali', method: 'UPI' },
    { day: 7, cat: 'cat_food', amount: 48500, desc: 'Zomato - Pizza Gourmet Dinner', method: 'UPI' },
    { day: 9, cat: 'cat_groceries', amount: 85000, desc: 'Blinkit 10-Min Essentials', method: 'UPI' },
    { day: 11, cat: 'cat_shopping', amount: 189900, desc: 'Amazon.in Electronic Accessories', method: 'Credit Card' },
    { day: 13, cat: 'cat_transport', amount: 24000, desc: 'Uber Ride to Hitech City', method: 'UPI' },
    { day: 14, cat: 'cat_food', amount: 2000, desc: 'Chai & Osmania Biscuit Tapri', method: 'Cash' },
    { day: 16, cat: 'cat_health', amount: 65000, desc: 'Apollo Pharmacy Health & Vitamins', method: 'UPI' },
    { day: 18, cat: 'cat_groceries', amount: 198000, desc: 'DMart Hypermarket Monthly Supplies', method: 'Credit Card' },
    { day: 20, cat: 'cat_shopping', amount: 245000, desc: 'Myntra Casual Apparel Sale', method: 'Credit Card' },
    { day: 22, cat: 'cat_entertainment', amount: 75000, desc: 'BookMyShow PVR IMAX Tickets', method: 'UPI' },
    { day: 24, cat: 'cat_food', amount: 42000, desc: 'Swiggy - South Indian Breakfast', method: 'UPI' },
    { day: 26, cat: 'cat_transport', amount: 31000, desc: 'Ola Prime Ride Airport Drop', method: 'UPI' },
    { day: 28, cat: 'cat_food', amount: 28000, desc: 'Blue Tokai Specialty Coffee', method: 'UPI' },
  ];

  for (const v of variableExpenses) {
    if (m.month === 10 && v.day > 5) continue; // Current month October stops at kickoff window
    const dStr = `${ym}-${pad(v.day)}`;
    insertTx.run(`tx_seed_${globalTxCounter++}`, demoUserId, v.cat, v.amount, 'EXPENSE', v.desc, dStr, v.method, 'Regular transaction', JSON.stringify([]), null, 0, null, nowIso, nowIso);
  }
}

// 5. Seed Coffee (12 txns) and Gaming (28 txns) per 13.2 specification
const coffeeNames = [
  'Blue Tokai Single Origin Pourover', 'Third Wave Coffee Cortado', 'Starbucks Blonde Roast', 'Chai Point Masala Chai',
  'Cold Brew & Croissant', 'Araku Specialty Coffee', 'Matcha Latte Third Wave', 'Flat White Blue Tokai',
  'Subko Craft Coffee Mumbai', 'Roastery Coffee House Hyderabad', 'Iced Americano Starbucks', 'Specialty Drip Brew'
];
for (let i = 0; i < 12; i++) {
  const dStr = `2026-09-${pad((i % 28) + 1)}`;
  insertTx.run(`tx_seed_coffee_${i}`, demoUserId, 'cat_custom_coffee', 22000 + (i * 2000), 'EXPENSE', coffeeNames[i], dStr, 'UPI', 'Daily coffee run', JSON.stringify([]), null, 0, null, nowIso, nowIso);
}

const gamingNames = [
  'Steam India Summer Sale', 'PlayStation Plus Annual', 'Nintendo eShop Indie Title', 'Discord Nitro Monthly',
  'Xbox Game Pass PC India', 'Twitch Creator Subscription', 'Cyberpunk Phantom Liberty', 'Elden Ring Shadow of Erdtree',
  'Mechanical Gaming Keycaps', 'Steam Deck OLED Case', 'Humble Bundle India', 'GOG Classic Collection',
  'Razer Mousepad & Grips', 'Battle Pass Valorant Points', 'Valve CS2 Prime Upgrade', 'Epic Games Weekly Deal',
  'Final Fantasy XIV Sub', 'Factorio Space Age', 'Hollow Knight Silksong Preorder', 'RetroArch Controller Adapter',
  'Origin EA Play Monthly', 'Ubisoft+ Classics', 'Blizzard Battle.net Token', 'GeForce NOW Priority Tier',
  'Sony DualSense Charging Dock', 'Capcom Monster Hunter Wilds', 'Steam Workshop Asset Pack', 'Itch.io Creator Bundle'
];
for (let i = 0; i < 28; i++) {
  const mIdx = (i % 5) + 5;
  const day = (i % 25) + 1;
  const dStr = `2026-${pad(mIdx)}-${pad(day)}`;
  insertTx.run(`tx_seed_gaming_${i}`, demoUserId, 'cat_custom_gaming', 149900 + (i * 10000), 'EXPENSE', gamingNames[i], dStr, 'UPI', 'Gaming purchases', JSON.stringify([]), null, 0, null, nowIso, nowIso);
}

// 6. Seed Specific Anomalies (Starbucks outlier & Netflix duplicate)
const txStarbucksId = 'tx_seed_starbucks_spike';
insertTx.run(txStarbucksId, demoUserId, 'cat_food', 120000, 'EXPENSE', 'Starbucks Reserve Coffee & Tasting', '2026-10-04', 'Credit Card', 'Unusual high spend', JSON.stringify(['flagged']), null, 0, null, nowIso, nowIso);

const txNetflix1 = 'tx_seed_netflix_dup1';
const txNetflix2 = 'tx_seed_netflix_dup2';
insertTx.run(txNetflix1, demoUserId, 'cat_subscriptions', 64900, 'EXPENSE', 'Netflix Premium', '2026-10-04', 'Credit Card', 'Monthly streaming renewal 1', JSON.stringify([]), null, 0, null, nowIso, nowIso);
insertTx.run(txNetflix2, demoUserId, 'cat_subscriptions', 64900, 'EXPENSE', 'Netflix Premium', '2026-10-04', 'Credit Card', 'Accidental duplicate charge from gateway', JSON.stringify([]), null, 0, null, nowIso, nowIso);

// 7. Seed Budgets
db.prepare('DELETE FROM budgets').run();
const insertBudget = db.prepare(`
  INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertBudget.run('bdg_user_overall', demoUserId, null, 5000000, 'MONTHLY', nowIso, nowIso); // ₹50,000 monthly cap
insertBudget.run('bdg_user_housing', demoUserId, 'cat_housing', 2500000, 'MONTHLY', nowIso, nowIso); // ₹25,000 rent
insertBudget.run('bdg_user_food', demoUserId, 'cat_food', 1000000, 'MONTHLY', nowIso, nowIso); // ₹10,000 food
insertBudget.run('bdg_user_ent', demoUserId, 'cat_entertainment', 500000, 'MONTHLY', nowIso, nowIso); // ₹5,000 entertainment
insertBudget.run('bdg_user_gaming', demoUserId, 'cat_custom_gaming', 500000, 'MONTHLY', nowIso, nowIso); // ₹5,000 gaming

// 8. Seed Subscriptions
db.prepare('DELETE FROM subscriptions').run();
const insertSub = db.prepare(`
  INSERT INTO subscriptions (id, user_id, merchant, amount_minor, cadence, next_charge_at, dismissed, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSub.run('sub_1', demoUserId, 'Netflix Premium', 64900, 'MONTHLY', '2026-11-04', 0, nowIso);
insertSub.run('sub_2', demoUserId, 'Spotify Premium India', 11900, 'MONTHLY', '2026-11-12', 0, nowIso);
insertSub.run('sub_3', demoUserId, 'Cult.fit Gym & Fitness', 185000, 'MONTHLY', '2026-11-15', 0, nowIso);
insertSub.run('sub_4', demoUserId, 'Jio Fiber Broadband', 99900, 'MONTHLY', '2026-11-20', 0, nowIso);

// 9. Savings Goals
db.prepare('DELETE FROM savings_goals').run();
const insertGoal = db.prepare(`
  INSERT INTO savings_goals (id, user_id, name, target_minor, current_minor, deadline, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertGoal.run('goal_1', demoUserId, 'Emergency Fund (6 Months Expenses)', 30000000, 21500000, '2026-12-31', nowIso); // ₹3 Lakh target
insertGoal.run('goal_2', demoUserId, 'Royal Enfield Himalayan 450', 32000000, 18000000, '2027-03-31', nowIso); // ₹3.2 Lakh target
insertGoal.run('goal_3', demoUserId, 'MacBook Pro M4', 19990000, 11000000, '2026-11-30', nowIso); // ₹1.99 Lakh target

// 10. Recurring Rules
db.prepare('DELETE FROM recurring_rules').run();
const insertRec = db.prepare(`
  INSERT INTO recurring_rules (id, user_id, merchant, amount_minor, category_id, cadence, next_run_at, paused, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertRec.run('rec_1', demoUserId, 'Apartment Rent - Gachibowli', 2200000, 'cat_housing', 'MONTHLY', '2026-11-05', 0, nowIso);
insertRec.run('rec_2', demoUserId, 'Nippon India Small Cap SIP', 500000, 'cat_investments', 'MONTHLY', '2026-11-10', 0, nowIso);
insertRec.run('rec_3', demoUserId, 'Jio Postpaid 5G Recharge', 29900, 'cat_utilities', 'MONTHLY', '2026-11-15', 0, nowIso);

// 11. Anomaly Alerts
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
  'Transaction amount ₹1,200.00 is 3x higher than your Food & Dining 90-day average.',
  JSON.stringify({ amount: 120000, categoryAvg: 40000, multiplier: 3.0, merchant: 'Starbucks Reserve' }),
  'Transaction amount ₹1,200.00 is 3x higher than your Food & Dining 90-day average.',
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
  'Detected identical ₹649.00 charge within 24 hours from Netflix.',
  JSON.stringify({ amount: 64900, duplicateTxId: txNetflix1, merchant: 'Netflix Premium' }),
  'Detected identical ₹649.00 charge within 24 hours from Netflix.',
  null,
  null,
  nowIso
);

// 12. PAYMENTS INBOX: Seed 15 realistic pending notifications for user@demo.com (§3.2)
db.prepare('DELETE FROM inbox_notifications').run();
const insertInbox = db.prepare(`
  INSERT INTO inbox_notifications (
    id, user_id, source, amount_minor, merchant, raw_payload,
    suggested_category_id, confidence, status, received_at,
    confirmed_at, transaction_id, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL, NULL, ?)
`);

const nowMs = Date.now();
const minutesAgo = (m) => new Date(nowMs - m * 60 * 1000).toISOString();

const inboxSeedItems = [
  // 6 UPI Debits
  {
    source: 'UPI',
    merchant: 'Swiggy',
    amount: 34000,
    cat: 'cat_food',
    conf: 'HIGH',
    mins: 2,
    raw: { type: 'UPI_DEBIT', amount: 34000, merchant: 'Swiggy', account: 'HDFC Bank ****4821', ref: 'UPI/4281/342198' },
  },
  {
    source: 'UPI',
    merchant: 'Zomato',
    amount: 48500,
    cat: 'cat_food',
    conf: 'HIGH',
    mins: 15,
    raw: { type: 'UPI_DEBIT', amount: 48500, merchant: 'Zomato', account: 'ICICI Bank ****9022', ref: 'UPI/9912/771024' },
  },
  {
    source: 'UPI',
    merchant: 'Uber India',
    amount: 14500,
    cat: 'cat_transport',
    conf: 'HIGH',
    mins: 42,
    raw: { type: 'UPI_DEBIT', amount: 14500, merchant: 'Uber India', account: 'HDFC Bank ****4821', ref: 'UPI/3104/891230' },
  },
  {
    source: 'UPI',
    merchant: 'Blinkit',
    amount: 42000,
    cat: 'cat_groceries',
    conf: 'HIGH',
    mins: 110,
    raw: { type: 'UPI_DEBIT', amount: 42000, merchant: 'Blinkit', account: 'HDFC Bank ****4821', ref: 'UPI/1092/448190' },
  },
  {
    source: 'UPI',
    merchant: 'BigBasket',
    amount: 185000,
    cat: 'cat_groceries',
    conf: 'HIGH',
    mins: 230,
    raw: { type: 'UPI_DEBIT', amount: 185000, merchant: 'BigBasket', account: 'ICICI Bank ****9022', ref: 'UPI/7712/990142' },
  },
  {
    source: 'UPI',
    merchant: 'Chai Point',
    amount: 6500,
    cat: 'cat_custom_coffee',
    conf: 'MED',
    mins: 340,
    raw: { type: 'UPI_DEBIT', amount: 6500, merchant: 'Chai Point', account: 'HDFC Bank ****4821', ref: 'UPI/0019/332190' },
  },
  // 5 Card Swipes
  {
    source: 'CARD',
    merchant: 'Amazon.in',
    amount: 249900,
    cat: 'cat_shopping',
    conf: 'HIGH',
    mins: 18,
    raw: { type: 'CARD_SWIPE', amount: 249900, merchant: 'Amazon.in', card: 'Amazon Pay ICICI CC ****7712', ref: 'AUTH_AMZ8912' },
  },
  {
    source: 'CARD',
    merchant: 'Flipkart',
    amount: 129900,
    cat: 'cat_shopping',
    conf: 'HIGH',
    mins: 480,
    raw: { type: 'CARD_SWIPE', amount: 129900, merchant: 'Flipkart', card: 'HDFC Regalia CC ****3309', ref: 'AUTH_FK33190' },
  },
  {
    source: 'CARD',
    merchant: 'Croma Electronics',
    amount: 389000,
    cat: 'cat_shopping',
    conf: 'MED',
    mins: 720,
    raw: { type: 'CARD_SWIPE', amount: 389000, merchant: 'Croma Electronics', card: 'HDFC Regalia CC ****3309', ref: 'AUTH_CROMA441' },
  },
  {
    source: 'CARD',
    merchant: 'Apollo Pharmacy',
    amount: 85000,
    cat: 'cat_health',
    conf: 'HIGH',
    mins: 960,
    raw: { type: 'CARD_SWIPE', amount: 85000, merchant: 'Apollo Pharmacy', card: 'ICICI Coral CC ****9022', ref: 'AUTH_APOLLO99' },
  },
  {
    source: 'CARD',
    merchant: 'Starbucks India',
    amount: 68000,
    cat: 'cat_custom_coffee',
    conf: 'MED',
    mins: 1200,
    raw: { type: 'CARD_SWIPE', amount: 68000, merchant: 'Starbucks India', card: 'ICICI Coral CC ****9022', ref: 'AUTH_SBUX1109' },
  },
  // 4 Email Receipts
  {
    source: 'EMAIL',
    merchant: 'Zomato Online Order',
    amount: 54000,
    cat: 'cat_food',
    conf: 'HIGH',
    mins: 60,
    raw: { type: 'EMAIL_RECEIPT', amount: 54000, merchant: 'Zomato', subject: 'Your Zomato order #ZOM8821 confirmation', ref: 'ORD_ZOM8821' },
  },
  {
    source: 'EMAIL',
    merchant: 'IRCTC Train Ticket',
    amount: 145000,
    cat: 'cat_transport',
    conf: 'HIGH',
    mins: 540,
    raw: { type: 'EMAIL_RECEIPT', amount: 145000, merchant: 'IRCTC', subject: 'ERS Ticket for PNR 429188019 - Hyderabad to Bangalore', ref: 'PNR_429188019' },
  },
  {
    source: 'EMAIL',
    merchant: 'Jio Prepaid Recharge',
    amount: 29900,
    cat: 'cat_utilities',
    conf: 'HIGH',
    mins: 1400,
    raw: { type: 'EMAIL_RECEIPT', amount: 29900, merchant: 'Jio', subject: 'Payment receipt for Jio Mobile 9876543210', ref: 'REC_JIO99182' },
  },
  {
    source: 'EMAIL',
    merchant: 'BookMyShow',
    amount: 92000,
    cat: 'cat_entertainment',
    conf: 'MED',
    mins: 1800,
    raw: { type: 'EMAIL_RECEIPT', amount: 92000, merchant: 'BookMyShow', subject: 'Booking Confirmed - BMS Order #WXY8891', ref: 'BMS_WXY8891' },
  },
];

for (let i = 0; i < inboxSeedItems.length; i++) {
  const item = inboxSeedItems[i];
  const notifId = `inbox_seed_${i + 1}`;
  const recTime = minutesAgo(item.mins);
  insertInbox.run(
    notifId,
    demoUserId,
    item.source,
    item.amount,
    item.merchant,
    JSON.stringify(item.raw),
    item.cat,
    item.conf,
    recTime,
    recTime
  );
}

// 12.5 Seed Demo Cards for Alex Mercer (user@demo.com)
db.prepare('DELETE FROM demo_cards').run();
db.prepare('DELETE FROM webhook_events').run();

const insertDemoCard = db.prepare(`
  INSERT INTO demo_cards (
    id, user_id, token, brand, last4, holder_name, expiry_month, expiry_year, nickname, is_active, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`);

insertDemoCard.run(
  'card_demo_1',
  demoUserId,
  'card_tok_1111_icici_demo',
  'VISA',
  '1111',
  'Alex Mercer',
  12,
  2028,
  'ICICI Coral Credit Card',
  nowIso
);

insertDemoCard.run(
  'card_demo_2',
  demoUserId,
  'card_tok_4821_hdfc_demo',
  'RUPAY',
  '4821',
  'Alex Mercer',
  6,
  2027,
  'HDFC Millennia RuPay Debit',
  nowIso
);

// 13. Security & Admin Platform Data (no personal finance for admin)
db.prepare('DELETE FROM feature_flags').run();
const insertFlag = db.prepare(`
  INSERT INTO feature_flags (id, key, name, description, enabled, last_modified_by, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertFlag.run('flag_1', 'enable_inbox_ai', 'Payments Inbox Auto-Categorization', 'Autonomous heuristic ingestion engine for UPI, Card, and SMS alerts.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_2', 'enable_anomalies', 'Anomaly Detection Engine', 'Real-time outlier monitoring with numeric severity scoring.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_3', 'enforce_2fa_global', 'Global 2FA Enforcement', 'Mandate time-based two-factor authentication for all logins.', 0, 'admin@demo.com', nowIso);
insertFlag.run('flag_4', 'enable_recurring_cron', 'Recurring Transaction Cron', 'Daily background scheduler for automatic transaction ledger creation.', 1, 'admin@demo.com', nowIso);
insertFlag.run('flag_5', 'enable_ai_demo_mode', 'AI Local Mock Engine', 'Deterministic local LLM mock fallback when external keys are unconfigured.', 1, 'admin@demo.com', nowIso);

db.prepare('DELETE FROM login_attempts').run();
const insertLogin = db.prepare(`
  INSERT INTO login_attempts (id, email, ip_address, status, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
insertLogin.run('log_1', 'admin@demo.com', '192.168.1.104', 'BAD_PASSWORD', '2026-10-05T18:22:10Z');
insertLogin.run('log_2', 'unknown@attacker.xyz', '45.33.32.156', 'USER_NOT_FOUND', '2026-10-06T02:11:00Z');
insertLogin.run('log_3', 'admin@demo.com', '127.0.0.1', 'SUCCESS', '2026-10-06T09:00:00Z');
insertLogin.run('log_4', 'user@demo.com', '127.0.0.1', 'SUCCESS', '2026-10-06T09:05:00Z');

db.prepare('DELETE FROM ip_blocklist').run();
const insertBlock = db.prepare(`
  INSERT INTO ip_blocklist (id, ip, reason, added_by, added_at, expires_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertBlock.run('blk_1', '45.33.32.156', 'Automated brute-force credential stuffing attempt detected.', 'SYSTEM_RATE_LIMITER', '2026-10-06T02:15:00Z', null);

db.prepare('DELETE FROM user_sessions').run();
const insertSession = db.prepare(`
  INSERT INTO user_sessions (id, user_id, token_hash, device_label, ip_address, location, last_seen, created_at, revoked_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSession.run('sess_user_active', demoUserId, 'hash_curr_user', 'Chrome 129 on Windows 11', '127.0.0.1', 'Hyderabad, IN', nowIso, '2026-10-06T08:00:00Z', null);
insertSession.run('sess_admin_active', demoAdminId, 'hash_curr_admin', 'Brave 1.70 on macOS Sonoma', '127.0.0.1', 'Hyderabad, IN', nowIso, '2026-10-06T08:30:00Z', null);

// 14. Cryptographic Audit Chain Initialization
db.prepare('DELETE FROM audit_logs').run();
logAudit(demoAdminId, 'SEED_DATABASE_EXPANDED', 'system', 'fintrack.db', {
  transactionsCount: globalTxCounter - 1,
  usersCount: 2,
  monthsCovered: 6,
  dateRange: '2026-05-01 to 2026-10-05',
  locale: 'en-IN (INR)',
  inboxNotificationsSeeded: inboxSeedItems.length,
});

logAudit(demoUserId, 'INBOX_INITIALIZED', 'inbox_notifications', null, {
  pendingCount: inboxSeedItems.length,
  sources: ['UPI', 'CARD', 'EMAIL'],
});

logAudit(demoUserId, 'AUTH_SESSION_CREATED', 'auth', 'sess_user_active', {
  client: 'Chrome 129 on Windows 11',
  ip: '127.0.0.1',
  location: 'Hyderabad, IN'
});

console.log(`\n======================================================`);
console.log(`FINTRACK SEED COMPLETE (v4.0 - India Localization & Inbox)`);
console.log(`User: user@demo.com (Shruthin Reddy) | Admin: admin@demo.com`);
console.log(`Total transactions created: ${globalTxCounter - 1} (All in exact paise minor units)`);
console.log(`Payments Inbox: ${inboxSeedItems.length} live pending notifications`);
console.log(`Covered: 6 months (2026-05-01 to 2026-10-05)`);
console.log(`Budgets: 5 | Subscriptions: 4 | Goals: 3 | Flags: 5`);
console.log(`======================================================\n`);
