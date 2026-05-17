const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ecommerce.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    category_id INTEGER,
    stock INTEGER DEFAULT 0,
    sizes TEXT DEFAULT 's,m,l,xl,xxl',
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  db.run("ALTER TABLE products ADD COLUMN sizes TEXT DEFAULT 's,m,l,xl,xxl'", () => {});

db.run(`CREATE TABLE IF NOT EXISTS orders (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    size TEXT,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    size TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  db.run("ALTER TABLE orders ADD COLUMN order_number TEXT", () => {});

  db.run("ALTER TABLE order_items ADD COLUMN size TEXT", () => {});
  db.run("ALTER TABLE cart_items ADD COLUMN size TEXT", () => {});

  // Seed data
  db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Women', 'Women clothing and accessories']);
      db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Men', 'Men clothing and accessories']);
      db.run("INSERT INTO categories (name, description) VALUES (?, ?)", ['Boutique', 'Curated boutique pieces']);
    }
  });

  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)",
        ['Floral Midi Dress', 'A comfortable floral dress for everyday wear.', 49.99, 'https://via.placeholder.com/400x400?text=Floral+Midi+Dress', 1, 22]);
      db.run("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)",
        ['Classic Denim Jacket', 'Timeless denim jacket with a relaxed fit.', 79.99, 'https://via.placeholder.com/400x400?text=Denim+Jacket', 2, 15]);
      db.run("INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES (?, ?, ?, ?, ?, ?)",
        ['Boutique Statement Bag', 'Designer-inspired bag that matches any outfit.', 129.99, 'https://via.placeholder.com/400x400?text=Statement+Bag', 3, 8]);
    }
  });

  // Seed admin user
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
    if (row.count === 0) {
      // Use ADMIN_PASSWORD from environment, or fall back to the current default.
      // Change ADMIN_PASSWORD in your backend .env file for a stronger admin password.
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const bcrypt = require('bcryptjs');
      bcrypt.hash(adminPassword, 10, (err, hashedPassword) => {
        if (!err) {
          db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            ['Admin User', 'admin@fosogo.com', hashedPassword, 'admin']);
        }
      });
    }
  });
});

function promisifyRun(method) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      method.call(db, ...args, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };
}

function promisifyAll(method) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      method.call(db, ...args, function(err, result) {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

const getCollection = async (table) => {
  return promisifyAll(db.all.bind(db))(`SELECT * FROM ${table}`);
};
const findById = async (table, id) => {
  const rows = await promisifyAll(db.all.bind(db))(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
};
const insertItem = async (table, item) => {
  const keys = Object.keys(item);
  const values = Object.values(item);
  const placeholders = keys.map(() => '?').join(',');
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
  const result = await promisifyRun(db.run.bind(db))(sql, values);
  return { id: result.lastID, ...item };
};
const updateItem = async (table, id, updates) => {
  const keys = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = keys.map(key => `${key} = ?`).join(',');
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  await promisifyRun(db.run.bind(db))(sql, [...values, id]);
  return { id, ...updates };
};
const removeItem = async (table, id) => {
  await promisifyRun(db.run.bind(db))(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return true;
};

module.exports = {
  getCollection,
  findById,
  insertItem,
  updateItem,
  removeItem,
};
