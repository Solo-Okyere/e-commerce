const Database = require('better-sqlite3');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const defaultDbPath = fs.existsSync('/var/data')
  ? '/var/data/ecommerce.db'
  : path.resolve(__dirname, 'ecommerce.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;
const db = new Database(dbPath);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((row) => row.name === column);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'customer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image_url TEXT,
  category_id INTEGER,
  stock INTEGER DEFAULT 0,
  sizes TEXT DEFAULT 's,m,l,xl,xxl',
  FOREIGN KEY (category_id) REFERENCES categories(id)
)`).run();

addColumnIfMissing('products', 'sizes', "TEXT DEFAULT 's,m,l,xl,xxl'");

db.prepare(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE,
  user_id INTEGER,
  customer_email TEXT,
  checkout_key TEXT,
  payment_provider TEXT,
  payment_reference TEXT,
  payment_status TEXT,
  payment_details TEXT,
  paid_at DATETIME,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  shipping_address TEXT,
  payment_method TEXT,
  currency TEXT DEFAULT 'GHS',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  size TEXT,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  size TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'GHS',
  authorization_url TEXT,
  access_code TEXT,
  provider_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS order_email_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending',
  resend_email_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  failed_at DATETIME,
  UNIQUE(order_id, type),
  FOREIGN KEY (order_id) REFERENCES orders(id)
)`).run();

addColumnIfMissing('orders', 'order_number', 'TEXT');
addColumnIfMissing('orders', 'customer_email', 'TEXT');
addColumnIfMissing('orders', 'checkout_key', 'TEXT');
addColumnIfMissing('orders', 'payment_provider', 'TEXT');
addColumnIfMissing('orders', 'payment_reference', 'TEXT');
addColumnIfMissing('orders', 'payment_status', 'TEXT');
addColumnIfMissing('orders', 'payment_details', 'TEXT');
addColumnIfMissing('orders', 'paid_at', 'DATETIME');
addColumnIfMissing('order_items', 'size', 'TEXT');
addColumnIfMissing('cart_items', 'size', 'TEXT');

db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_key ON orders(checkout_key) WHERE checkout_key IS NOT NULL').run();
db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference) WHERE payment_reference IS NOT NULL').run();

// Seed data
const categoriesCount = db.prepare("SELECT COUNT(*) as count FROM categories").get();
if (categoriesCount.count === 0) {
  db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)").run('Women', 'Women clothing and accessories');
  db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)").run('Men', 'Men clothing and accessories');
  db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)").run('Boutique', 'Curated boutique pieces');
}

const productsCount = db.prepare("SELECT COUNT(*) as count FROM products").get();
if (productsCount.count === 0) {
  db.prepare("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)").run(
    'Floral Midi Dress', 'A comfortable floral dress for everyday wear.', 49.99, 'https://via.placeholder.com/400x400?text=Floral+Midi+Dress', 1, 22);
  db.prepare("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)").run(
    'Classic Denim Jacket', 'Timeless denim jacket with a relaxed fit.', 79.99, 'https://via.placeholder.com/400x400?text=Denim+Jacket', 2, 15);
  db.prepare("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)").run(
    'Boutique Statement Bag', 'Designer-inspired bag that matches any outfit.', 129.99, 'https://via.placeholder.com/400x400?text=Statement+Bag', 3, 8);
}

const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
if (adminCount.count === 0) {
  const bcrypt = require('bcryptjs');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
    'Admin User', 'admin@fosogo.com', hashedPassword, 'admin');
}

const getCollection = (table) => {
  return db.prepare(`SELECT * FROM ${table}`).all();
};

const findById = (table, id) => {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
};

const insertItem = (table, item) => {
  const keys = Object.keys(item);
  const values = Object.values(item);
  const placeholders = keys.map(() => '?').join(',');
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
  const result = db.prepare(sql).run(...values);
  return { id: result.lastInsertRowid, ...item };
};

const updateItem = (table, id, updates) => {
  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map(key => `${key} = ?`).join(',');
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return { id, ...updates };
};

const removeItem = (table, id) => {
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return true;
};

const findOrderByCheckoutKey = (checkoutKey) => {
  if (!checkoutKey) return null;
  return db.prepare('SELECT * FROM orders WHERE checkout_key = ?').get(checkoutKey);
};

const findOrderByPaymentReference = (reference) => {
  if (!reference) return null;
  return db.prepare('SELECT * FROM orders WHERE payment_reference = ?').get(reference);
};

const upsertPaymentTransaction = (transaction) => {
  db.prepare(`
    INSERT INTO payment_transactions (
      order_id, provider, reference, status, amount, currency, authorization_url,
      access_code, provider_response, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(reference) DO UPDATE SET
      status = excluded.status,
      authorization_url = COALESCE(excluded.authorization_url, payment_transactions.authorization_url),
      access_code = COALESCE(excluded.access_code, payment_transactions.access_code),
      provider_response = excluded.provider_response,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    transaction.order_id,
    transaction.provider,
    transaction.reference,
    transaction.status,
    transaction.amount,
    transaction.currency,
    transaction.authorization_url || null,
    transaction.access_code || null,
    transaction.provider_response || null
  );

  return db.prepare('SELECT * FROM payment_transactions WHERE reference = ?').get(transaction.reference);
};

const updatePaymentTransaction = (reference, updates) => {
  const allowedKeys = ['status', 'provider_response', 'authorization_url', 'access_code'];
  const keys = Object.keys(updates).filter((key) => allowedKeys.includes(key));
  if (keys.length === 0) return db.prepare('SELECT * FROM payment_transactions WHERE reference = ?').get(reference);

  const values = keys.map((key) => updates[key]);
  const setClause = keys.map((key) => `${key} = ?`).join(', ');
  db.prepare(`
    UPDATE payment_transactions
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE reference = ?
  `).run(...values, reference);

  return db.prepare('SELECT * FROM payment_transactions WHERE reference = ?').get(reference);
};

const createEmailNotificationIfMissing = (orderId, type, recipient) => {
  try {
    const result = db.prepare(`
      INSERT INTO order_email_notifications (order_id, type, recipient, status)
      VALUES (?, ?, ?, 'sending')
    `).run(orderId, type, recipient);

    return { created: true, id: result.lastInsertRowid };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return {
        created: false,
        notification: db.prepare(`
          SELECT * FROM order_email_notifications WHERE order_id = ? AND type = ?
        `).get(orderId, type),
      };
    }

    throw error;
  }
};

const markEmailNotificationSent = (id, resendEmailId) => {
  db.prepare(`
    UPDATE order_email_notifications
    SET status = 'sent', resend_email_id = ?, sent_at = CURRENT_TIMESTAMP, error_message = NULL
    WHERE id = ?
  `).run(resendEmailId || null, id);
};

const markEmailNotificationFailed = (id, errorMessage) => {
  db.prepare(`
    UPDATE order_email_notifications
    SET status = 'failed', error_message = ?, failed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(String(errorMessage || 'Unknown email error').slice(0, 1000), id);
};

module.exports = {
  getCollection,
  findById,
  insertItem,
  updateItem,
  removeItem,
  findOrderByCheckoutKey,
  findOrderByPaymentReference,
  upsertPaymentTransaction,
  updatePaymentTransaction,
  createEmailNotificationIfMissing,
  markEmailNotificationSent,
  markEmailNotificationFailed,
};
