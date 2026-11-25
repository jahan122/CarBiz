// Headless test of the SQLite layer (runs under plain Node, no Electron needed).
// Usage: npm run test:db   (requires better-sqlite3 built for Node: `npm rebuild better-sqlite3`)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CarDealsDb } = require('../dist-electron/db.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cardeals-'));
const file = path.join(tmp, 'sub', 'test.db');
let db = new CarDealsDb(file);

// --- seed ---
let deals = db.listDeals();
assert.equal(deals.length, 2, 'seeds exactly 2 records');
const active = deals.find((d) => d.status === 'ACTIVE');
const sold = deals.find((d) => d.status === 'SOLD');
assert.ok(active && sold, 'one active + one sold');
assert.equal(db.listExpenses(active.id).length, 2, 'active car has 2 expenses');
assert.equal(active.total_expenses, 50000);
const soldProfit = sold.sale_price - (sold.purchase_price + sold.total_expenses);
assert.equal(soldProfit, 2300000 - (2050000 + 37000));
assert.ok(soldProfit > 0, 'sold car shows a profit');

// --- reopen must NOT reseed or wipe data ---
db.close();
db = new CarDealsDb(file);
assert.equal(db.listDeals().length, 2, 'data persists, no re-seed');

// --- create / update ---
const created = db.createDeal({
  make: 'Honda', model: 'Civic', variant: '', year: 2016, color: 'Black',
  registration_number: ' abc-123 ', chassis_number: '', mileage: null,
  bought_from_location: 'Islamabad', purchase_date: '2026-11-01', purchase_price: 4000000,
  seller_name: 'Test Seller', seller_contact: '0300-0000000', seller_cnic: '', notes: '',
});
assert.equal(created.status, 'ACTIVE');
assert.equal(created.registration_number, 'ABC-123', 'reg # trimmed + uppercased');
assert.equal(created.variant, null, 'empty optional -> NULL');
const upd = db.updateDeal(created.id, { ...created, color: 'Red' });
assert.equal(upd.color, 'Red');

// --- expenses ---
const e1 = db.addExpense(created.id, { category: 'Parts', description: 'Alternator', amount: 25000, date: '2026-11-03' });
db.addExpense(created.id, { category: 'Commission', description: 'Broker', amount: 10000, date: '2026-11-04' });
assert.equal(db.listDeals().find((d) => d.id === created.id).total_expenses, 35000);
db.updateExpense(e1.id, { category: 'Parts', description: 'Alternator + belt', amount: 27000, date: '2026-11-03' });
assert.equal(db.listDeals().find((d) => d.id === created.id).total_expenses, 37000);
db.deleteExpense(e1.id);
assert.equal(db.listDeals().find((d) => d.id === created.id).total_expenses, 10000);
const odd = db.addExpense(created.id, { category: 'Bogus', description: '', amount: '', date: '' });
assert.equal(odd.category, 'Other', 'unknown category falls back to Other');
assert.equal(odd.amount, 0, 'blank amount saves as 0');
db.deleteExpense(odd.id);
assert.throws(() => db.addExpense(99999, { category: 'Parts', description: '', amount: 1, date: '2026-11-01' }), 'FK enforced');

// --- sell / edit sale / revert ---
const s = db.markSold(created.id, { sale_price: 4300000, sale_date: '2026-11-10', purchaser_name: 'Buyer', purchaser_contact: '0311-1111111', purchaser_cnic: null });
assert.equal(s.status, 'SOLD');
assert.equal(s.sale_price - (s.purchase_price + s.total_expenses), 4300000 - 4010000);
const r = db.revertSale(created.id);
assert.equal(r.status, 'ACTIVE');
assert.equal(r.sale_price, null);

// --- CSV ---
const csv = db.exportCsv();
assert.ok(csv.startsWith('﻿'), 'CSV has BOM for Excel');
assert.equal(csv.trim().split('\r\n').length, 1 + 3, 'header + 3 rows');
assert.ok(csv.includes('Corolla') && csv.includes('Alto'));

// --- backup ---
const bak = path.join(tmp, 'backup.db');
db.backupTo(bak).then(() => {
  assert.ok(fs.statSync(bak).size > 0);
  const copy = new CarDealsDb(bak);
  assert.equal(copy.listDeals().length, 3, 'backup contains all data');
  copy.close();

  // --- delete cascades expenses ---
  db.deleteDeal(created.id);
  const left = db.db.prepare('SELECT COUNT(*) c FROM expenses WHERE car_deal_id = ?').get(created.id).c;
  assert.equal(left, 0, 'ON DELETE CASCADE removed expenses');
  assert.equal(db.listDeals().length, 2);
  // --- nothing is required: a completely blank car saves ---
  const blank = db.createDeal({});
  assert.equal(blank.status, 'ACTIVE');
  assert.equal(blank.make, null);
  assert.equal(blank.purchase_price, null);
  db.updateDeal(blank.id, { make: '  Toyota ', year: 'abc', purchase_price: 'Rs 1,250,000', engine_number: '1NZ-123' });
  const b2 = db.listDeals().find((d) => d.id === blank.id);
  db.updateDeal(blank.id, { ...b2, seller_address: '  Plot 9, Lahore ' });
  assert.equal(db.listDeals().find((d) => d.id === blank.id).seller_address, 'Plot 9, Lahore');
  assert.equal(b2.make, 'Toyota'); assert.equal(b2.year, null); assert.equal(b2.purchase_price, 1250000); assert.equal(b2.engine_number, '1NZ-123');

  // --- direct sold entry (no buying slip): created already SOLD, purchase details empty ---
  const direct = db.createDeal({ make: 'Honda', model: 'City', registration_number: 'xyz 12' }, { sale_price: '3,100,000', sale_date: '2026-11-12', purchaser_name: 'Direct Buyer', purchaser_contact: '0300-1112223' });
  assert.equal(direct.status, 'SOLD'); assert.equal(direct.sale_price, 3100000); assert.equal(direct.purchase_price, null);
  assert.equal(direct.registration_number, 'XYZ 12');
  const blankSale = db.createDeal({ make: 'Suzuki' }, {});
  assert.equal(blankSale.status, 'SOLD'); assert.equal(blankSale.sale_price, null);
  for (const id of [blank.id, direct.id, blankSale.id]) db.deleteDeal(id);

  // --- legacy database (old schema with NOT NULL columns) upgrades without losing anything ---
  {
    const { openDatabase } = require('../dist-electron/sqlite-driver.js');
    const legacyFile = path.join(tmp, 'legacy', 'old.db');
    fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
    const old = openDatabase(legacyFile);
    old.exec(`
      CREATE TABLE car_deals (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SOLD')),
        make TEXT NOT NULL, model TEXT NOT NULL, variant TEXT, year INTEGER NOT NULL, color TEXT NOT NULL, registration_number TEXT NOT NULL,
        chassis_number TEXT, mileage INTEGER, bought_from_location TEXT NOT NULL, purchase_date TEXT NOT NULL, purchase_price REAL NOT NULL,
        seller_name TEXT NOT NULL, seller_contact TEXT NOT NULL, seller_cnic TEXT, sale_date TEXT, sale_price REAL, purchaser_name TEXT,
        purchaser_contact TEXT, purchaser_cnic TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, car_deal_id INTEGER NOT NULL, category TEXT NOT NULL CHECK (category IN
        ('Mechanic/Repair','Denting/Painting','Parts','Detailing','Commission','Documentation/Tax','Other')), description TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL, date TEXT NOT NULL, FOREIGN KEY (car_deal_id) REFERENCES car_deals(id) ON DELETE CASCADE);
      CREATE INDEX idx_expenses_deal ON expenses(car_deal_id);
      INSERT INTO car_deals (make, model, year, color, registration_number, bought_from_location, purchase_date, purchase_price, seller_name, seller_contact)
        VALUES ('Toyota','Yaris',2021,'Red','LEG-001','Karachi','2026-10-01',3000000,'Old Seller','0300-1111111');
      INSERT INTO car_deals (make, model, year, color, registration_number, bought_from_location, purchase_date, purchase_price, seller_name, seller_contact, status, sale_price, sale_date, purchaser_name, purchaser_contact)
        VALUES ('Honda','Vezel',2019,'White','LEG-002','Lahore','2026-09-01',5000000,'S2','0300-2222222','SOLD',5400000,'2026-10-10','B2','0300-3333333');
      INSERT INTO expenses (car_deal_id, category, description, amount, date) VALUES (1,'Parts','Brake pads',10000,'2026-10-02'),(1,'Detailing','Wash',2000,'2026-10-03'),(2,'Parts','Tyres',40000,'2026-09-05');
      PRAGMA user_version = 1;`);
    old.close();

    const mig = new CarDealsDb(legacyFile);
    const rows = mig.listDeals();
    assert.equal(rows.length, 2, 'legacy rows kept');
    const yaris = rows.find((d) => d.model === 'Yaris');
    assert.equal(yaris.registration_number, 'LEG-001'); assert.equal(yaris.total_expenses, 12000, 'expenses survived (no cascade delete)');
    assert.equal(rows.find((d) => d.model === 'Vezel').status, 'SOLD');
    assert.equal(rows.find((d) => d.model === 'Vezel').sale_price, 5400000);
    assert.ok(mig.listExpenses(yaris.id).length === 2);
    assert.ok(fs.existsSync(path.join(path.dirname(legacyFile), 'car-deals-before-update.db')), 'pre-upgrade backup written');
    const blankLegacy = mig.createDeal({});               // NOT NULL gone
    assert.ok(blankLegacy.id > 2, 'autoincrement continues after migration');
    mig.updateDeal(yaris.id, { ...yaris, engine_number: 'ENG-9', seller_address: 'House 7, Karachi' });   // new columns exist
    assert.equal(mig.listDeals().find((d) => d.id === yaris.id).engine_number, 'ENG-9');
    assert.equal(mig.listDeals().find((d) => d.id === yaris.id).seller_address, 'House 7, Karachi');
    mig.deleteDeal(blankLegacy.id);
    mig.close();
    const again = new CarDealsDb(legacyFile);            // second open: no re-migration, no re-seed
    assert.equal(again.listDeals().length, 2);
    assert.equal(again.listExpenses(yaris.id).length, 2);
    again.close();
  }

  // --- deleting the samples must be permanent (no re-seed on reopen) ---
  for (const d of db.listDeals()) db.deleteDeal(d.id);
  assert.equal(db.listDeals().length, 0);
  db.close();
  db = new CarDealsDb(file);
  assert.equal(db.listDeals().length, 0, 'deleted sample data stays deleted after reopen');
  // legacy DB from an older version (tables exist, user_version 0, empty) must not be re-seeded either
  db.db.exec('PRAGMA user_version = 0');
  db.close();
  db = new CarDealsDb(file);
  assert.equal(db.listDeals().length, 0, 'legacy empty DB is not re-seeded');
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ALL DB TESTS PASSED');
});
