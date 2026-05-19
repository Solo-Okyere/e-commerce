const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(__dirname, 'ecommerce.db');
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

addColumnIfMissing('orders', 'order_number', 'TEXT');
addColumnIfMissing('order_items', 'size', 'TEXT');
addColumnIfMissing('cart_items', 'size', 'TEXT');

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

module.exports = {
  getCollection,
  findById,
  insertItem,
  updateItem,
  removeItem,
};
