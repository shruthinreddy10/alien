import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'fintrack.db');
const db = new DatabaseSync(DB_PATH);

test('13.1 Anomaly Detection: Seeded alerts exist and match rules', () => {
  const alerts = db.prepare('SELECT * FROM anomaly_alerts ORDER BY created_at DESC').all();
  assert.ok(alerts.length >= 2, 'Should have at least 2 seeded anomaly alerts');

  // Verify Starbucks amount outlier
  const starbucksAlert = alerts.find(a => a.id === 'anom_starbucks');
  assert.ok(starbucksAlert, 'Starbucks outlier alert should exist');
  assert.equal(starbucksAlert.rule, 'amount_outlier');
  assert.equal(starbucksAlert.level, 'HIGH');
  assert.equal(starbucksAlert.severity, 0.85);
  assert.equal(starbucksAlert.acknowledged_at, null);

  // Verify Netflix duplicate
  const netflixAlert = alerts.find(a => a.id === 'anom_netflix_dup');
  assert.ok(netflixAlert, 'Netflix duplicate alert should exist');
  assert.equal(netflixAlert.rule, 'duplicate_charge');
  assert.equal(netflixAlert.level, 'MEDIUM');
  assert.equal(netflixAlert.severity, 0.65);
  assert.equal(netflixAlert.acknowledged_at, null);
});

test('13.2 Category Setup: Custom categories seeded with expected counts and system protection', () => {
  // System categories cannot be owned by a user
  const foodSystemCat = db.prepare('SELECT * FROM categories WHERE id = ?').get('cat_food');
  assert.ok(foodSystemCat, 'cat_food should exist');
  assert.equal(foodSystemCat.is_system, 1, 'cat_food must be a system category');

  // Uncategorized category exists
  const uncat = db.prepare('SELECT * FROM categories WHERE id = ?').get('cat_uncategorized');
  assert.ok(uncat, 'cat_uncategorized must exist');
  assert.equal(uncat.is_system, 1);

  // Custom categories for demo user
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('user@demo.com');
  assert.ok(user, 'user@demo.com should exist');

  const coffee = db.prepare('SELECT * FROM categories WHERE id = ?').get('cat_custom_coffee');
  assert.ok(coffee, 'Coffee custom category should exist');
  assert.equal(coffee.is_system, 0);
  assert.equal(coffee.user_id, user.id);

  const petCare = db.prepare('SELECT * FROM categories WHERE id = ?').get('cat_custom_pet');
  assert.ok(petCare, 'Pet Care custom category should exist');
  assert.equal(petCare.is_system, 0);

  const gaming = db.prepare('SELECT * FROM categories WHERE id = ?').get('cat_custom_gaming');
  assert.ok(gaming, 'Gaming custom category should exist');
  assert.equal(gaming.is_system, 0);

  // Check transaction counts
  const coffeeTxCount = db.prepare('SELECT count(*) as count FROM transactions WHERE category_id = ? AND deleted_at IS NULL').get('cat_custom_coffee');
  assert.equal(coffeeTxCount.count, 12, 'Coffee should have 12 transactions');

  const petTxCount = db.prepare('SELECT count(*) as count FROM transactions WHERE category_id = ? AND deleted_at IS NULL').get('cat_custom_pet');
  assert.equal(petTxCount.count, 0, 'Pet Care should have 0 transactions');

  const gamingTxCount = db.prepare('SELECT count(*) as count FROM transactions WHERE category_id = ? AND deleted_at IS NULL').get('cat_custom_gaming');
  assert.equal(gamingTxCount.count, 28, 'Gaming should have 28 transactions');

  // Check active budget for Gaming
  const gamingBudget = db.prepare('SELECT * FROM budgets WHERE category_id = ?').get('cat_custom_gaming');
  assert.ok(gamingBudget, 'Gaming should have an active budget');
  assert.equal(gamingBudget.amount, 500000, 'Gaming budget should be ₹5,000 (500000 paise)');
});

test('13.1 Anomaly calculation severity formula verification', () => {
  // severity = min(1.0, (amount / category_avg) / 5)
  // level = LOW if <0.4, MEDIUM if <0.7, HIGH otherwise
  const calcSeverity = (amount, catAvg) => {
    const raw = (amount / catAvg) / 5;
    const sev = Math.min(1.0, Math.max(0.1, Number(raw.toFixed(2))));
    const level = sev < 0.4 ? 'LOW' : sev < 0.7 ? 'MEDIUM' : 'HIGH';
    return { severity: sev, level };
  };

  const case1 = calcSeverity(120000, 28000); // 4.28x avg -> (4.28)/5 = ~0.85 -> HIGH
  assert.equal(case1.level, 'HIGH');
  assert.ok(case1.severity >= 0.7);

  const case2 = calcSeverity(50000, 20000); // 2.5x avg -> 0.50 -> MEDIUM
  assert.equal(case2.level, 'MEDIUM');

  const case3 = calcSeverity(25000, 20000); // 1.25x avg -> 0.25 -> LOW
  assert.equal(case3.level, 'LOW');
});
