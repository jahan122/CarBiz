"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarDealsDb = exports.DEFAULT_BUSINESS_PROFILE = exports.PAYMENT_METHODS = exports.PAYMENT_TYPES = exports.EXPENSE_CATEGORIES = exports.ATTACHMENT_CATEGORIES = void 0;
const sqlite_driver_1 = require("./sqlite-driver");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
exports.ATTACHMENT_CATEGORIES = [
    'CNIC_FRONT',
    'CNIC_BACK',
    'REGISTRATION_BOOK',
    'SMART_CARD',
    'OTHER',
];
exports.EXPENSE_CATEGORIES = [
    'Mechanic/Repair',
    'Denting/Painting',
    'Parts',
    'Detailing',
    'Commission',
    'Documentation/Tax',
    'Other',
];
exports.PAYMENT_TYPES = ['Advance', 'Installment', 'Final Balance', 'Token', 'Other'];
exports.PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online/JazzCash/EasyPaisa', 'Other'];
exports.DEFAULT_BUSINESS_PROFILE = {
    business_name: '',
    tagline: '',
    owner_name: 'Sultan Ansari',
    father_name: 'Masood Hussain Ansari',
    cnic: '42101-6548938-7',
    phone: '0333-3048451',
    address: 'H.No C-39, Block 16, Gulistan-e-Jauhar, Karachi',
};
const DEAL_COLUMNS = [
    'make', 'model', 'variant', 'year', 'color', 'horse_power', 'registration_number', 'chassis_number', 'engine_number', 'mileage',
    'bought_from_location', 'purchase_date', 'purchase_price',
    'seller_name', 'seller_father_name', 'seller_contact', 'seller_cnic', 'seller_address',
    'notes', 'created_by',
];
const SALE_COLUMNS = [
    'sale_date', 'sale_price',
    'purchaser_name', 'purchaser_father_name', 'purchaser_contact', 'purchaser_cnic', 'purchaser_address',
];
const TRANSFER_COLUMNS = [
    'transfer_status', 'transfer_agent_name', 'transfer_agent_contact',
    'file_handover_date', 'transfer_completed_date', 'transfer_cost', 'transfer_notes',
];
const ALL_COLUMNS = [
    'id', 'status', ...DEAL_COLUMNS, ...SALE_COLUMNS, ...TRANSFER_COLUMNS, 'deleted_at', 'created_at',
];
const carDealsDdl = (table) => `
CREATE TABLE ${table} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SOLD')),
  make TEXT,
  model TEXT,
  variant TEXT,
  year INTEGER,
  color TEXT,
  horse_power TEXT,
  registration_number TEXT,
  chassis_number TEXT,
  engine_number TEXT,
  mileage INTEGER,
  bought_from_location TEXT,
  purchase_date TEXT,
  purchase_price REAL,
  seller_name TEXT,
  seller_father_name TEXT,
  seller_contact TEXT,
  seller_cnic TEXT,
  seller_address TEXT,
  sale_date TEXT,
  sale_price REAL,
  purchaser_name TEXT,
  purchaser_father_name TEXT,
  purchaser_contact TEXT,
  purchaser_cnic TEXT,
  purchaser_address TEXT,
  transfer_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (transfer_status IN ('PENDING','WITH_AGENT','COMPLETED')),
  transfer_agent_name TEXT,
  transfer_agent_contact TEXT,
  file_handover_date TEXT,
  transfer_completed_date TEXT,
  transfer_cost REAL NOT NULL DEFAULT 0,
  transfer_notes TEXT,
  notes TEXT,
  created_by TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS car_deals (
${carDealsDdl('x').split('\n').slice(2, -1).join('\n')}
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_deal_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Mechanic/Repair','Denting/Painting','Parts','Detailing','Commission','Documentation/Tax','Other'
  )),
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  created_by TEXT,
  FOREIGN KEY (car_deal_id) REFERENCES car_deals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_deal_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('OUT_TO_SELLER','IN_FROM_BUYER')),
  payment_type TEXT NOT NULL DEFAULT 'Installment',
  method TEXT NOT NULL DEFAULT 'Cash',
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  FOREIGN KEY (car_deal_id) REFERENCES car_deals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deal_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_deal_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'CNIC_FRONT','CNIC_BACK','REGISTRATION_BOOK','SMART_CARD','OTHER'
  )),
  label TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (car_deal_id) REFERENCES car_deals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF' CHECK (role IN ('OWNER','STAFF')),
  can_view_profit INTEGER NOT NULL DEFAULT 0,
  can_manage_payments INTEGER NOT NULL DEFAULT 1,
  can_mark_sold INTEGER NOT NULL DEFAULT 1,
  can_delete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_deal ON expenses(car_deal_id);
CREATE INDEX IF NOT EXISTS idx_payments_deal ON payments(car_deal_id);
CREATE INDEX IF NOT EXISTS idx_attachments_deal ON deal_attachments(car_deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON car_deals(status);
`;
const DB_VERSION = 5;
const str = (v) => {
    if (v === null || v === undefined)
        return null;
    const t = String(v).trim();
    return t === '' ? null : t;
};
const num = (v) => {
    if (v === null || v === undefined)
        return null;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    const t = String(v).replace(/[^0-9.\-]/g, '');
    if (t === '' || t === '-' || t === '.')
        return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
};
const int = (v) => {
    const n = num(v);
    return n === null ? null : Math.trunc(n);
};
const DEAL_SELECT = `
  SELECT d.*,
    COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.car_deal_id = d.id), 0) AS total_expenses,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.car_deal_id = d.id AND p.direction = 'OUT_TO_SELLER'), 0) AS paid_to_seller,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.car_deal_id = d.id AND p.direction = 'IN_FROM_BUYER'), 0) AS received_from_buyer,
    COALESCE((SELECT COUNT(*) FROM deal_attachments a WHERE a.car_deal_id = d.id), 0) AS attachment_count
  FROM car_deals d
`;
function mapUserRow(r) {
    const isOwner = r.role === 'OWNER';
    return {
        id: r.id,
        name: r.name,
        role: r.role,
        can_view_profit: isOwner ? true : Boolean(r.can_view_profit),
        can_manage_payments: isOwner ? true : Boolean(r.can_manage_payments),
        can_mark_sold: isOwner ? true : Boolean(r.can_mark_sold),
        can_delete: isOwner ? true : Boolean(r.can_delete),
        created_at: r.created_at,
    };
}
class CarDealsDb {
    db;
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
        if (filePath !== ':memory:')
            node_fs_1.default.mkdirSync(node_path_1.default.dirname(filePath), { recursive: true });
        this.db = (0, sqlite_driver_1.openDatabase)(filePath);
        const existed = !!this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'car_deals'").get();
        this.db.exec(SCHEMA);
        this.migrate();
        const version = Number(this.db.prepare('PRAGMA user_version').get().user_version);
        if (version < 1 && !existed)
            this.seedIfEmpty();
        if (version < DB_VERSION)
            this.db.exec(`PRAGMA user_version = ${DB_VERSION}`);
    }
    close() {
        this.db.close();
    }
    migrate() {
        const cols = this.db.prepare('PRAGMA table_info(car_deals)').all();
        const names = new Set(cols.map((c) => c.name));
        const strict = cols.some((c) => c.name === 'make' && c.notnull === 1);
        if (!strict) {
            const textCols = [
                'engine_number',
                'seller_address',
                'purchaser_address',
                'deleted_at',
                'horse_power',
                'seller_father_name',
                'purchaser_father_name',
                'transfer_agent_name',
                'transfer_agent_contact',
                'file_handover_date',
                'transfer_completed_date',
                'transfer_notes',
                'created_by',
            ];
            for (const col of textCols) {
                if (!names.has(col))
                    this.db.exec(`ALTER TABLE car_deals ADD COLUMN ${col} TEXT`);
            }
            if (!names.has('transfer_status')) {
                this.db.exec(`ALTER TABLE car_deals ADD COLUMN transfer_status TEXT NOT NULL DEFAULT 'PENDING'`);
            }
            if (!names.has('transfer_cost')) {
                this.db.exec(`ALTER TABLE car_deals ADD COLUMN transfer_cost REAL NOT NULL DEFAULT 0`);
            }
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_deleted ON car_deals(deleted_at)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_transfer ON car_deals(transfer_status)');
        }
        else {
            this.safetyBackup();
            const keep = ALL_COLUMNS.filter((c) => names.has(c)).join(', ');
            this.db.exec('PRAGMA foreign_keys = OFF');
            try {
                this.db.exec('BEGIN');
                try {
                    this.db.exec(carDealsDdl('car_deals_new'));
                    this.db.exec(`INSERT INTO car_deals_new (${keep}) SELECT ${keep} FROM car_deals`);
                    this.db.exec('DROP TABLE car_deals');
                    this.db.exec('ALTER TABLE car_deals_new RENAME TO car_deals');
                    this.db.exec('COMMIT');
                }
                catch (err) {
                    this.db.exec('ROLLBACK');
                    throw err;
                }
            }
            finally {
                this.db.exec('PRAGMA foreign_keys = ON');
            }
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_status ON car_deals(status)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_deleted ON car_deals(deleted_at)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_deals_transfer ON car_deals(transfer_status)');
        }
        // Ensure created_by exists on expenses & payments
        const expCols = this.db.prepare('PRAGMA table_info(expenses)').all();
        if (!expCols.some((c) => c.name === 'created_by')) {
            this.db.exec('ALTER TABLE expenses ADD COLUMN created_by TEXT');
        }
        const payCols = this.db.prepare('PRAGMA table_info(payments)').all();
        if (!payCols.some((c) => c.name === 'created_by')) {
            this.db.exec('ALTER TABLE payments ADD COLUMN created_by TEXT');
        }
        // Migrate legacy single PIN from app_settings into app_users as Owner if app_users is empty
        const userCount = this.db.prepare('SELECT COUNT(*) AS c FROM app_users').get().c;
        if (userCount === 0) {
            const legacySalt = this.getSetting('pin_salt');
            const legacyHash = this.getSetting('pin_hash');
            if (legacySalt && legacyHash) {
                const ownerName = this.getBusinessProfile().owner_name || 'Owner';
                this.db
                    .prepare(`INSERT INTO app_users (name, pin_salt, pin_hash, role, can_view_profit, can_manage_payments, can_mark_sold, can_delete)
             VALUES (?, ?, ?, 'OWNER', 1, 1, 1, 1)`)
                    .run(ownerName, legacySalt, legacyHash);
            }
        }
    }
    safetyBackup() {
        if (this.filePath === ':memory:')
            return;
        try {
            const dest = node_path_1.default.join(node_path_1.default.dirname(this.filePath), 'car-deals-before-update.db');
            if (!node_fs_1.default.existsSync(dest))
                this.db.backupTo(dest);
        }
        catch {
            /* ignore */
        }
    }
    // ---------- Deals (Sorted by Purchase Date Descending) ----------
    listDeals() {
        return this.db
            .prepare(`${DEAL_SELECT}
         WHERE d.deleted_at IS NULL
         ORDER BY
           CASE WHEN d.purchase_date IS NULL OR d.purchase_date = '' THEN 1 ELSE 0 END ASC,
           d.purchase_date DESC,
           d.id DESC`)
            .all();
    }
    listDeletedDeals() {
        return this.db
            .prepare(`${DEAL_SELECT}
         WHERE d.deleted_at IS NOT NULL
         ORDER BY d.deleted_at DESC, d.id DESC`)
            .all();
    }
    getDealById(id) {
        const row = this.db.prepare(`${DEAL_SELECT} WHERE d.id = ?`).get(id);
        if (!row)
            throw new Error(`Car deal ${id} not found`);
        return row;
    }
    normalizeDeal(i) {
        return {
            make: str(i.make),
            model: str(i.model),
            variant: str(i.variant),
            year: int(i.year),
            color: str(i.color),
            horse_power: str(i.horse_power),
            registration_number: str(i.registration_number)?.toUpperCase() ?? null,
            chassis_number: str(i.chassis_number),
            engine_number: str(i.engine_number),
            mileage: int(i.mileage),
            bought_from_location: str(i.bought_from_location),
            purchase_date: str(i.purchase_date),
            purchase_price: num(i.purchase_price),
            seller_name: str(i.seller_name),
            seller_father_name: str(i.seller_father_name),
            seller_contact: str(i.seller_contact),
            seller_cnic: str(i.seller_cnic),
            seller_address: str(i.seller_address),
            notes: str(i.notes),
            created_by: str(i.created_by),
        };
    }
    createDeal(input, sale) {
        const v = this.normalizeDeal(input);
        const cols = DEAL_COLUMNS.join(', ');
        const placeholders = DEAL_COLUMNS.map((c) => '@' + c).join(', ');
        const run = this.db.transaction(() => {
            const info = this.db.prepare(`INSERT INTO car_deals (${cols}, status) VALUES (${placeholders}, 'ACTIVE')`).run(v);
            const id = info.lastInsertRowid;
            if (sale)
                this.markSold(id, sale);
            return id;
        });
        return this.getDealById(run());
    }
    updateDeal(id, input) {
        const { created_by: _ignored, ...rest } = this.normalizeDeal(input);
        const editableCols = DEAL_COLUMNS.filter((c) => c !== 'created_by');
        const sets = editableCols.map((c) => `${c} = @${c}`).join(', ');
        const info = this.db.prepare(`UPDATE car_deals SET ${sets} WHERE id = @id`).run({ ...rest, id });
        if (info.changes === 0)
            throw new Error(`Car deal ${id} not found`);
        return this.getDealById(id);
    }
    softDeleteDeal(id) {
        const now = new Date().toISOString();
        const info = this.db.prepare('UPDATE car_deals SET deleted_at = ? WHERE id = ?').run(now, id);
        if (info.changes === 0)
            throw new Error(`Car deal ${id} not found`);
    }
    restoreDeal(id) {
        const info = this.db.prepare('UPDATE car_deals SET deleted_at = NULL WHERE id = ?').run(id);
        if (info.changes === 0)
            throw new Error(`Car deal ${id} not found`);
        return this.getDealById(id);
    }
    deleteDeal(id) {
        this.db.prepare('DELETE FROM car_deals WHERE id = ?').run(id);
    }
    emptyRecycleBin() {
        this.db.prepare('DELETE FROM car_deals WHERE deleted_at IS NOT NULL').run();
    }
    markSold(id, sale) {
        const info = this.db
            .prepare(`UPDATE car_deals SET status = 'SOLD', sale_price = @sale_price, sale_date = @sale_date,
           purchaser_name = @purchaser_name, purchaser_father_name = @purchaser_father_name,
           purchaser_contact = @purchaser_contact, purchaser_cnic = @purchaser_cnic,
           purchaser_address = @purchaser_address
         WHERE id = @id`)
            .run({
            id,
            sale_price: num(sale.sale_price),
            sale_date: str(sale.sale_date),
            purchaser_name: str(sale.purchaser_name),
            purchaser_father_name: str(sale.purchaser_father_name),
            purchaser_contact: str(sale.purchaser_contact),
            purchaser_cnic: str(sale.purchaser_cnic),
            purchaser_address: str(sale.purchaser_address),
        });
        if (info.changes === 0)
            throw new Error(`Car deal ${id} not found`);
        return this.getDealById(id);
    }
    revertSale(id) {
        this.db
            .prepare(`UPDATE car_deals SET status = 'ACTIVE', sale_price = NULL, sale_date = NULL,
           purchaser_name = NULL, purchaser_father_name = NULL, purchaser_contact = NULL,
           purchaser_cnic = NULL, purchaser_address = NULL WHERE id = ?`)
            .run(id);
        return this.getDealById(id);
    }
    // ---------- File Handover & Excise Transfer Tracking ----------
    updateTransfer(id, input) {
        const completedDate = str(input.transfer_completed_date);
        const handoverDate = str(input.file_handover_date);
        const rawStatus = String(input.transfer_status ?? '');
        let status = rawStatus === 'COMPLETED' || rawStatus === 'WITH_AGENT' || rawStatus === 'PENDING'
            ? rawStatus
            : 'PENDING';
        if (completedDate) {
            status = 'COMPLETED';
        }
        else if (handoverDate && status === 'PENDING') {
            status = 'WITH_AGENT';
        }
        const info = this.db
            .prepare(`UPDATE car_deals SET
           transfer_status = @transfer_status,
           transfer_agent_name = @transfer_agent_name,
           transfer_agent_contact = @transfer_agent_contact,
           file_handover_date = @file_handover_date,
           transfer_completed_date = @transfer_completed_date,
           transfer_cost = @transfer_cost,
           transfer_notes = @transfer_notes
         WHERE id = @id`)
            .run({
            id,
            transfer_status: status,
            transfer_agent_name: str(input.transfer_agent_name),
            transfer_agent_contact: str(input.transfer_agent_contact),
            file_handover_date: handoverDate,
            transfer_completed_date: completedDate,
            transfer_cost: num(input.transfer_cost) ?? 0,
            transfer_notes: str(input.transfer_notes),
        });
        if (info.changes === 0)
            throw new Error(`Car deal ${id} not found`);
        return this.getDealById(id);
    }
    // ---------- Document & Photo Attachments ----------
    listAttachments(dealId) {
        return this.db
            .prepare('SELECT * FROM deal_attachments WHERE car_deal_id = ? ORDER BY created_at DESC, id DESC')
            .all(dealId);
    }
    addAttachment(dealId, input) {
        const category = exports.ATTACHMENT_CATEGORIES.includes(input.category)
            ? input.category
            : 'OTHER';
        const label = str(input.label) ?? category;
        const fileName = str(input.file_name) ?? 'document';
        const filePath = str(input.file_path);
        if (!filePath)
            throw new Error('Attachment file_path is required');
        const info = this.db
            .prepare(`INSERT INTO deal_attachments (car_deal_id, category, label, file_name, file_path)
         VALUES (?, ?, ?, ?, ?)`)
            .run(dealId, category, label, fileName, filePath);
        return this.db.prepare('SELECT * FROM deal_attachments WHERE id = ?').get(info.lastInsertRowid);
    }
    deleteAttachment(id) {
        const existing = this.db.prepare('SELECT * FROM deal_attachments WHERE id = ?').get(id);
        if (existing) {
            this.db.prepare('DELETE FROM deal_attachments WHERE id = ?').run(id);
        }
        return existing;
    }
    // ---------- Expenses ----------
    listExpenses(dealId) {
        return this.db
            .prepare('SELECT * FROM expenses WHERE car_deal_id = ? ORDER BY date DESC, id DESC')
            .all(dealId);
    }
    expenseValues(input) {
        const cat = String(input.category ?? '');
        const category = exports.EXPENSE_CATEGORIES.includes(cat) ? cat : 'Other';
        return [category, str(input.description) ?? '', num(input.amount) ?? 0, str(input.date) ?? '', str(input.created_by)];
    }
    addExpense(dealId, input) {
        const [category, description, amount, date, created_by] = this.expenseValues(input);
        const info = this.db
            .prepare('INSERT INTO expenses (car_deal_id, category, description, amount, date, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            .run(dealId, category, description, amount, date, created_by);
        return this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    }
    updateExpense(id, input) {
        const [category, description, amount, date] = this.expenseValues(input);
        const info = this.db
            .prepare('UPDATE expenses SET category = ?, description = ?, amount = ?, date = ? WHERE id = ?')
            .run(category, description, amount, date, id);
        if (info.changes === 0)
            throw new Error(`Expense ${id} not found`);
        return this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    }
    deleteExpense(id) {
        this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    }
    // ---------- Payments ----------
    listPayments(dealId) {
        return this.db
            .prepare('SELECT * FROM payments WHERE car_deal_id = ? ORDER BY date ASC, id ASC')
            .all(dealId);
    }
    paymentValues(input) {
        const dirRaw = String(input.direction ?? '');
        const direction = dirRaw === 'IN_FROM_BUYER' ? 'IN_FROM_BUYER' : 'OUT_TO_SELLER';
        const typeRaw = String(input.payment_type ?? '');
        const payment_type = exports.PAYMENT_TYPES.includes(typeRaw) ? typeRaw : 'Installment';
        const methodRaw = String(input.method ?? '');
        const method = exports.PAYMENT_METHODS.includes(methodRaw) ? methodRaw : 'Cash';
        return [direction, payment_type, method, num(input.amount) ?? 0, str(input.date) ?? '', str(input.notes) ?? '', str(input.created_by)];
    }
    addPayment(dealId, input) {
        const [direction, payment_type, method, amount, date, notes, created_by] = this.paymentValues(input);
        const info = this.db
            .prepare('INSERT INTO payments (car_deal_id, direction, payment_type, method, amount, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(dealId, direction, payment_type, method, amount, date, notes, created_by);
        return this.db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
    }
    updatePayment(id, input) {
        const [direction, payment_type, method, amount, date, notes] = this.paymentValues(input);
        const info = this.db
            .prepare('UPDATE payments SET direction = ?, payment_type = ?, method = ?, amount = ?, date = ?, notes = ? WHERE id = ?')
            .run(direction, payment_type, method, amount, date, notes, id);
        if (info.changes === 0)
            throw new Error(`Payment ${id} not found`);
        return this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    }
    deletePayment(id) {
        this.db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    }
    // ---------- Multi-User Role-Based PIN Lock ----------
    hashPin(pin, salt) {
        return node_crypto_1.default.scryptSync(pin, salt, 32).toString('hex');
    }
    verifyHash(pin, salt, expectedHex) {
        const actual = this.hashPin(pin, salt);
        const a = Buffer.from(actual, 'hex');
        const b = Buffer.from(expectedHex, 'hex');
        return a.length === b.length && node_crypto_1.default.timingSafeEqual(a, b);
    }
    hasUsers() {
        const c = this.db.prepare('SELECT COUNT(*) AS c FROM app_users').get().c;
        return c > 0;
    }
    listUsers() {
        const rows = this.db.prepare("SELECT * FROM app_users ORDER BY CASE WHEN role = 'OWNER' THEN 0 ELSE 1 END ASC, id ASC").all();
        return rows.map(mapUserRow);
    }
    createUser(input) {
        const name = str(input.name);
        if (!name)
            throw new Error('User name is required');
        const cleanPin = String(input.pin ?? '').trim();
        if (!/^\d{4,8}$/.test(cleanPin))
            throw new Error('PIN must be 4 to 8 digits');
        const existing = this.db.prepare('SELECT * FROM app_users').all();
        for (const u of existing) {
            if (this.verifyHash(cleanPin, u.pin_salt, u.pin_hash)) {
                throw new Error('This PIN is already assigned to another user. Choose a different PIN.');
            }
        }
        const role = input.role === 'OWNER' ? 'OWNER' : 'STAFF';
        const isOwner = role === 'OWNER';
        const salt = node_crypto_1.default.randomBytes(16).toString('hex');
        const hash = this.hashPin(cleanPin, salt);
        const info = this.db
            .prepare(`INSERT INTO app_users (name, pin_salt, pin_hash, role, can_view_profit, can_manage_payments, can_mark_sold, can_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(name, salt, hash, role, isOwner || input.can_view_profit ? 1 : 0, isOwner || input.can_manage_payments !== false ? 1 : 0, isOwner || input.can_mark_sold !== false ? 1 : 0, isOwner || input.can_delete ? 1 : 0);
        const row = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(info.lastInsertRowid);
        return mapUserRow(row);
    }
    updateUser(id, input) {
        const current = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
        if (!current)
            throw new Error('User not found');
        const name = input.name !== undefined ? str(input.name) ?? current.name : current.name;
        const role = input.role === 'OWNER' || input.role === 'STAFF' ? input.role : current.role;
        if (current.role === 'OWNER' && role !== 'OWNER') {
            const ownerCount = this.db.prepare("SELECT COUNT(*) AS c FROM app_users WHERE role = 'OWNER'").get().c;
            if (ownerCount <= 1)
                throw new Error('At least one Owner account is required');
        }
        let salt = current.pin_salt;
        let hash = current.pin_hash;
        if (input.pin !== undefined && input.pin.trim() !== '') {
            const cleanPin = input.pin.trim();
            if (!/^\d{4,8}$/.test(cleanPin))
                throw new Error('PIN must be 4 to 8 digits');
            const others = this.db.prepare('SELECT * FROM app_users WHERE id != ?').all(id);
            for (const u of others) {
                if (this.verifyHash(cleanPin, u.pin_salt, u.pin_hash)) {
                    throw new Error('This PIN is already used by another user');
                }
            }
            salt = node_crypto_1.default.randomBytes(16).toString('hex');
            hash = this.hashPin(cleanPin, salt);
        }
        const isOwner = role === 'OWNER';
        const canViewProfit = isOwner ? 1 : input.can_view_profit !== undefined ? (input.can_view_profit ? 1 : 0) : current.can_view_profit;
        const canManagePayments = isOwner ? 1 : input.can_manage_payments !== undefined ? (input.can_manage_payments ? 1 : 0) : current.can_manage_payments;
        const canMarkSold = isOwner ? 1 : input.can_mark_sold !== undefined ? (input.can_mark_sold ? 1 : 0) : current.can_mark_sold;
        const canDelete = isOwner ? 1 : input.can_delete !== undefined ? (input.can_delete ? 1 : 0) : current.can_delete;
        this.db
            .prepare(`UPDATE app_users
         SET name = ?, pin_salt = ?, pin_hash = ?, role = ?,
             can_view_profit = ?, can_manage_payments = ?, can_mark_sold = ?, can_delete = ?
         WHERE id = ?`)
            .run(name, salt, hash, role, canViewProfit, canManagePayments, canMarkSold, canDelete, id);
        const updated = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
        return mapUserRow(updated);
    }
    deleteUser(id) {
        const target = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
        if (!target)
            return;
        if (target.role === 'OWNER') {
            const ownerCount = this.db.prepare("SELECT COUNT(*) AS c FROM app_users WHERE role = 'OWNER'").get().c;
            if (ownerCount <= 1)
                throw new Error('Cannot delete the only Owner account');
        }
        this.db.prepare('DELETE FROM app_users WHERE id = ?').run(id);
    }
    authenticatePin(pin, userId) {
        const clean = pin.trim();
        if (!clean)
            return null;
        if (userId !== undefined) {
            const row = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId);
            if (!row)
                return null;
            return this.verifyHash(clean, row.pin_salt, row.pin_hash) ? mapUserRow(row) : null;
        }
        const all = this.db.prepare('SELECT * FROM app_users').all();
        for (const row of all) {
            if (this.verifyHash(clean, row.pin_salt, row.pin_hash)) {
                return mapUserRow(row);
            }
        }
        return null;
    }
    hasPin() {
        return this.hasUsers();
    }
    // ---------- Settings & Dealer/Business Profile ----------
    getSetting(key) {
        const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
        return row ? row.value : null;
    }
    setSetting(key, value) {
        this.db
            .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(key, value);
    }
    getBusinessProfile() {
        return {
            business_name: this.getSetting('biz_name') ?? exports.DEFAULT_BUSINESS_PROFILE.business_name,
            tagline: this.getSetting('biz_tagline') ?? exports.DEFAULT_BUSINESS_PROFILE.tagline,
            owner_name: this.getSetting('biz_owner_name') ?? exports.DEFAULT_BUSINESS_PROFILE.owner_name,
            father_name: this.getSetting('biz_father_name') ?? exports.DEFAULT_BUSINESS_PROFILE.father_name,
            cnic: this.getSetting('biz_cnic') ?? exports.DEFAULT_BUSINESS_PROFILE.cnic,
            phone: this.getSetting('biz_phone') ?? exports.DEFAULT_BUSINESS_PROFILE.phone,
            address: this.getSetting('biz_address') ?? exports.DEFAULT_BUSINESS_PROFILE.address,
        };
    }
    setBusinessProfile(profile) {
        if (profile.business_name !== undefined)
            this.setSetting('biz_name', String(profile.business_name).trim());
        if (profile.tagline !== undefined)
            this.setSetting('biz_tagline', String(profile.tagline).trim());
        if (profile.owner_name !== undefined)
            this.setSetting('biz_owner_name', String(profile.owner_name).trim());
        if (profile.father_name !== undefined)
            this.setSetting('biz_father_name', String(profile.father_name).trim());
        if (profile.cnic !== undefined)
            this.setSetting('biz_cnic', String(profile.cnic).trim());
        if (profile.phone !== undefined)
            this.setSetting('biz_phone', String(profile.phone).trim());
        if (profile.address !== undefined)
            this.setSetting('biz_address', String(profile.address).trim());
        return this.getBusinessProfile();
    }
    // ---------- Backup / export ----------
    async backupTo(dest) {
        this.db.backupTo(dest);
    }
    exportCsv() {
        const deals = this.listDeals();
        const headers = [
            'ID', 'Status', 'Year', 'Make', 'Model', 'Variant', 'Color', 'Horse Power', 'Registration #', 'Chassis #', 'Engine #', 'Mileage',
            'Bought From', 'Purchase Date', 'Purchase Price', 'Paid to Seller', 'Balance Due to Seller',
            'General Expenses', 'Transfer Cost', 'Total Cost',
            'Seller Name', 'Seller S/O', 'Seller Contact', 'Seller CNIC', 'Seller Address',
            'Sale Date', 'Sale Price', 'Received from Buyer', 'Balance Due from Buyer',
            'Purchaser Name', 'Purchaser S/O', 'Purchaser Contact', 'Purchaser CNIC', 'Purchaser Address',
            'Transfer Status', 'Transfer Agent', 'File Handover Date', 'Transfer Completed Date',
            'Net Profit', 'Notes', 'Logged By', 'Entry Added At',
        ];
        const esc = (v) => {
            if (v === null || v === undefined)
                return '';
            let s = String(v);
            if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s)))
                s = "'" + s;
            return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const rows = deals.map((d) => {
            const transferCost = d.transfer_cost ?? 0;
            const total = (d.purchase_price ?? 0) + d.total_expenses + transferCost;
            const profit = d.status === 'SOLD' && d.sale_price !== null && d.purchase_price !== null ? d.sale_price - total : '';
            const sellerDue = d.purchase_price !== null ? Math.max(0, d.purchase_price - d.paid_to_seller) : '';
            const buyerDue = d.status === 'SOLD' && d.sale_price !== null ? Math.max(0, d.sale_price - d.received_from_buyer) : '';
            return [
                d.id, d.status, d.year, d.make, d.model, d.variant, d.color, d.horse_power, d.registration_number, d.chassis_number, d.engine_number, d.mileage,
                d.bought_from_location, d.purchase_date, d.purchase_price, d.paid_to_seller, sellerDue,
                d.total_expenses, transferCost, total,
                d.seller_name, d.seller_father_name, d.seller_contact, d.seller_cnic, d.seller_address,
                d.sale_date, d.sale_price, d.received_from_buyer, buyerDue,
                d.purchaser_name, d.purchaser_father_name, d.purchaser_contact, d.purchaser_cnic, d.purchaser_address,
                d.transfer_status, d.transfer_agent_name, d.file_handover_date, d.transfer_completed_date,
                profit, d.notes, d.created_by, d.created_at,
            ].map(esc).join(',');
        });
        return '\ufeff' + [headers.join(','), ...rows].join('\r\n') + '\r\n';
    }
    // ---------- Seed ----------
    seedIfEmpty() {
        const count = this.db.prepare('SELECT COUNT(*) AS c FROM car_deals').get().c;
        if (count > 0)
            return;
        const tx = this.db.transaction(() => {
            const active = this.createDeal({
                make: 'Toyota', model: 'Corolla', variant: 'GLi 1.3', year: 2018, color: 'White', horse_power: '1300 CC',
                registration_number: 'BXK-482', chassis_number: 'NZE141-9034521', engine_number: '1NZ-3318842', mileage: 68000,
                bought_from_location: 'Karachi', purchase_date: daysAgo(12), purchase_price: 3450000,
                seller_name: 'Imran Siddiqui', seller_father_name: 'Khalid Siddiqui', seller_contact: '0321-5550148', seller_cnic: '42101-1234567-1',
                seller_address: 'House 12, Block 5, Gulshan-e-Iqbal, Karachi',
                notes: 'Original paint, one owner. Needs minor suspension work.',
                created_by: 'System Seed',
            });
            this.addExpense(active.id, { category: 'Mechanic/Repair', description: 'Front suspension bushes & oil service', amount: 38000, date: daysAgo(9) });
            this.addExpense(active.id, { category: 'Detailing', description: 'Full interior/exterior detailing', amount: 12000, date: daysAgo(5) });
            this.addPayment(active.id, {
                direction: 'OUT_TO_SELLER', payment_type: 'Advance', method: 'Bank Transfer',
                amount: 2000000, date: daysAgo(12), notes: 'Token & initial advance via HBL',
            });
            this.updateTransfer(active.id, {
                transfer_status: 'WITH_AGENT',
                transfer_agent_name: 'Tariq Excise Agent',
                transfer_agent_contact: '0300-8214490',
                file_handover_date: daysAgo(4),
                transfer_cost: 18500,
                transfer_notes: 'Complete file & biometric slip handed over for transfer',
            });
            const sold = this.createDeal({
                make: 'Suzuki', model: 'Alto', variant: 'VXR', year: 2020, color: 'Silver', horse_power: '660 CC',
                registration_number: 'AHN-917', chassis_number: 'HA36S-8821764', engine_number: 'R06A-2209137', mileage: 41000,
                bought_from_location: 'Lahore', purchase_date: daysAgo(60), purchase_price: 2050000,
                seller_name: 'Usman Tariq', seller_father_name: 'Tariq Mahmood', seller_contact: '0333-5550192', seller_cnic: '35202-7654321-3',
                seller_address: '45-B, Model Town, Lahore',
                notes: 'Bought through dealer contact in Lahore.',
                created_by: 'System Seed',
            });
            this.addExpense(sold.id, { category: 'Denting/Painting', description: 'Rear bumper touch-up', amount: 15000, date: daysAgo(52) });
            this.addPayment(sold.id, {
                direction: 'OUT_TO_SELLER', payment_type: 'Final Balance', method: 'Bank Transfer',
                amount: 2050000, date: daysAgo(60), notes: 'Full payment on delivery',
            });
            this.markSold(sold.id, {
                sale_price: 2300000, sale_date: daysAgo(30),
                purchaser_name: 'Hamza Qureshi', purchaser_father_name: 'Naveed Qureshi', purchaser_contact: '0300-5550177', purchaser_cnic: '42201-9988776-5',
                purchaser_address: 'Flat 4-B, Clifton Block 2, Karachi',
            });
            this.updateTransfer(sold.id, {
                transfer_status: 'COMPLETED',
                transfer_agent_name: 'Tariq Excise Agent',
                transfer_agent_contact: '0300-8214490',
                file_handover_date: daysAgo(29),
                transfer_completed_date: daysAgo(21),
                transfer_cost: 22000,
                transfer_notes: 'Smart card & transfer cleared',
            });
            this.addPayment(sold.id, {
                direction: 'IN_FROM_BUYER', payment_type: 'Advance', method: 'Cash',
                amount: 500000, date: daysAgo(32), notes: 'Bayana / token received',
            });
            this.addPayment(sold.id, {
                direction: 'IN_FROM_BUYER', payment_type: 'Final Balance', method: 'Bank Transfer',
                amount: 1800000, date: daysAgo(30), notes: 'Final balance cleared at transfer',
            });
        });
        tx();
    }
}
exports.CarDealsDb = CarDealsDb;
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}
