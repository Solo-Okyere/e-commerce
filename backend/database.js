const { Pool, types } = require('pg');
const { loadEnv } = require('./config/env');

loadEnv();

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Configure it with your Neon PostgreSQL connection string.');
}

const shouldUseSsl =
  process.env.PGSSL === 'true' ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('sslmode=require');

function normalizeConnectionString(value) {
  try {
    const url = new URL(value);
    if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
      url.searchParams.delete('sslmode');
    }
    return url.toString();
  } catch {
    return value;
  }
}

const pool = new Pool({
  connectionString: normalizeConnectionString(connectionString),
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});

const allowedTables = new Set([
  'users',
  'categories',
  'products',
  'orders',
  'order_items',
  'cart_items',
  'payment_transactions',
  'order_email_notifications',
  'product_images',
]);

function assertAllowedTable(table) {
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }
}

function buildPlaceholders(count, offset = 1) {
  return Array.from({ length: count }, (_, index) => `$${index + offset}`).join(', ');
}

function normalizeRow(row) {
  if (!row) return row;
  if ('price' in row && row.price != null) row.price = Number(row.price);
  if ('total' in row && row.total != null) row.total = Number(row.total);
  if ('amount' in row && row.amount != null) row.amount = Number(row.amount);
  return row;
}

async function query(sql, params = []) {
  await initPromise;
  return pool.query(sql, params);
}

async function queryRaw(sql, params = []) {
  return pool.query(sql, params);
}

async function initDatabase() {
  await queryRaw(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(12, 2) NOT NULL,
      image_url TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      stock INTEGER DEFAULT 0,
      sizes TEXT DEFAULT 's,m,l,xl,xxl'
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_email TEXT,
      checkout_key TEXT,
      payment_provider TEXT,
      payment_reference TEXT,
      payment_status TEXT,
      payment_details TEXT,
      paid_at TIMESTAMPTZ,
      total NUMERIC(12, 2) NOT NULL,
      status TEXT DEFAULT 'pending',
      shipping_address TEXT,
      payment_method TEXT,
      currency TEXT DEFAULT 'GHS',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      size TEXT,
      price NUMERIC(12, 2) NOT NULL
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      size TEXT
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      amount NUMERIC(12, 2) NOT NULL,
      currency TEXT DEFAULT 'GHS',
      authorization_url TEXT,
      access_code TEXT,
      provider_response TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS order_email_notifications (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sending',
      resend_email_id TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      UNIQUE(order_id, type)
    )
  `);

  await queryRaw(`
    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryRaw(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  `);

  await queryRaw(`
    ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS description TEXT
  `);

  await queryRaw(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT 's,m,l,xl,xxl'
  `);

  await queryRaw(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_number TEXT,
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS customer_email TEXT,
      ADD COLUMN IF NOT EXISTS checkout_key TEXT,
      ADD COLUMN IF NOT EXISTS payment_provider TEXT,
      ADD COLUMN IF NOT EXISTS payment_reference TEXT,
      ADD COLUMN IF NOT EXISTS payment_status TEXT,
      ADD COLUMN IF NOT EXISTS payment_details TEXT,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS total NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS shipping_address TEXT,
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  `);

  await queryRaw(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS size TEXT,
      ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0
  `);

  await queryRaw(`
    ALTER TABLE cart_items
      ADD COLUMN IF NOT EXISTS size TEXT
  `);

  await queryRaw(`
    ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS',
      ADD COLUMN IF NOT EXISTS authorization_url TEXT,
      ADD COLUMN IF NOT EXISTS access_code TEXT,
      ADD COLUMN IF NOT EXISTS provider_response TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  `);

  await queryRaw(`
    ALTER TABLE order_email_notifications
      ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ
  `);

  await queryRaw('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_key ON orders(checkout_key) WHERE checkout_key IS NOT NULL');
  await queryRaw('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference) WHERE payment_reference IS NOT NULL');

  const categoriesCount = await queryRaw('SELECT COUNT(*)::int AS count FROM categories');
  if (categoriesCount.rows[0].count === 0) {
    await queryRaw(
      `INSERT INTO categories (name, description) VALUES
        ($1, $2),
        ($3, $4),
        ($5, $6)`,
      [
        'Women',
        'Women clothing and accessories',
        'Men',
        'Men clothing and accessories',
        'Boutique',
        'Curated boutique pieces',
      ]
    );
  }

  const productsCount = await queryRaw('SELECT COUNT(*)::int AS count FROM products');
  if (productsCount.rows[0].count === 0) {
    await queryRaw(
      `INSERT INTO products (name, description, price, image_url, category_id, stock) VALUES
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12),
        ($13, $14, $15, $16, $17, $18)`,
      [
        'Floral Midi Dress',
        'A comfortable floral dress for everyday wear.',
        49.99,
        'https://via.placeholder.com/400x400?text=Floral+Midi+Dress',
        1,
        22,
        'Classic Denim Jacket',
        'Timeless denim jacket with a relaxed fit.',
        79.99,
        'https://via.placeholder.com/400x400?text=Denim+Jacket',
        2,
        15,
        'Boutique Statement Bag',
        'Designer-inspired bag that matches any outfit.',
        129.99,
        'https://via.placeholder.com/400x400?text=Statement+Bag',
        3,
        8,
      ]
    );
  }

  const adminCount = await queryRaw("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  if (adminCount.rows[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    await queryRaw(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      ['Admin User', 'admin@fosogo.com', hashedPassword, 'admin']
    );
  }
}

const initPromise = initDatabase().catch((error) => {
  console.error('PostgreSQL initialization failed:', error);
  throw error;
});

const getCollection = async (table) => {
  assertAllowedTable(table);
  const result = await query(`SELECT * FROM ${table} ORDER BY id ASC`);
  return result.rows.map(normalizeRow);
};

const findById = async (table, id) => {
  assertAllowedTable(table);
  const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return normalizeRow(result.rows[0]);
};

const insertItem = async (table, item) => {
  assertAllowedTable(table);
  const keys = Object.keys(item);
  const values = Object.values(item);

  if (keys.length === 0) {
    throw new Error('Cannot insert an empty item.');
  }

  const result = await query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${buildPlaceholders(keys.length)}) RETURNING *`,
    values
  );
  return normalizeRow(result.rows[0]);
};

const updateItem = async (table, id, updates) => {
  assertAllowedTable(table);
  const keys = Object.keys(updates).filter((key) => updates[key] !== undefined);

  if (keys.length === 0) {
    return findById(table, id);
  }

  const values = keys.map((key) => updates[key]);
  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const result = await query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return normalizeRow(result.rows[0]);
};

const removeItem = async (table, id) => {
  assertAllowedTable(table);
  const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
};

const findOrderByCheckoutKey = async (checkoutKey) => {
  if (!checkoutKey) return null;
  const result = await query('SELECT * FROM orders WHERE checkout_key = $1', [checkoutKey]);
  return normalizeRow(result.rows[0]);
};

const findOrderByPaymentReference = async (reference) => {
  if (!reference) return null;
  const result = await query('SELECT * FROM orders WHERE payment_reference = $1', [reference]);
  return normalizeRow(result.rows[0]);
};

const upsertPaymentTransaction = async (transaction) => {
  const result = await query(
    `
      INSERT INTO payment_transactions (
        order_id, provider, reference, status, amount, currency, authorization_url,
        access_code, provider_response, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT(reference) DO UPDATE SET
        status = EXCLUDED.status,
        authorization_url = COALESCE(EXCLUDED.authorization_url, payment_transactions.authorization_url),
        access_code = COALESCE(EXCLUDED.access_code, payment_transactions.access_code),
        provider_response = EXCLUDED.provider_response,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [
      transaction.order_id,
      transaction.provider,
      transaction.reference,
      transaction.status,
      transaction.amount,
      transaction.currency,
      transaction.authorization_url || null,
      transaction.access_code || null,
      transaction.provider_response || null,
    ]
  );
  return normalizeRow(result.rows[0]);
};

const updatePaymentTransaction = async (reference, updates) => {
  const allowedKeys = ['status', 'provider_response', 'authorization_url', 'access_code'];
  const keys = Object.keys(updates).filter((key) => allowedKeys.includes(key));

  if (keys.length === 0) {
    const existing = await query('SELECT * FROM payment_transactions WHERE reference = $1', [reference]);
    return normalizeRow(existing.rows[0]);
  }

  const values = keys.map((key) => updates[key]);
  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const result = await query(
    `
      UPDATE payment_transactions
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE reference = $${keys.length + 1}
      RETURNING *
    `,
    [...values, reference]
  );
  return normalizeRow(result.rows[0]);
};

const createEmailNotificationIfMissing = async (orderId, type, recipient) => {
  const result = await query(
    `
      INSERT INTO order_email_notifications (order_id, type, recipient, status)
      VALUES ($1, $2, $3, 'sending')
      ON CONFLICT(order_id, type) DO NOTHING
      RETURNING id
    `,
    [orderId, type, recipient]
  );

  if (result.rows[0]) {
    return { created: true, id: result.rows[0].id };
  }

  const existing = await query(
    'SELECT * FROM order_email_notifications WHERE order_id = $1 AND type = $2',
    [orderId, type]
  );
  return { created: false, notification: normalizeRow(existing.rows[0]) };
};

const markEmailNotificationSent = async (id, resendEmailId) => {
  await query(
    `
      UPDATE order_email_notifications
      SET status = 'sent', resend_email_id = $1, sent_at = CURRENT_TIMESTAMP, error_message = NULL
      WHERE id = $2
    `,
    [resendEmailId || null, id]
  );
};

const markEmailNotificationFailed = async (id, errorMessage) => {
  await query(
    `
      UPDATE order_email_notifications
      SET status = 'failed', error_message = $1, failed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
    [String(errorMessage || 'Unknown email error').slice(0, 1000), id]
  );
};

const createProductImage = async (file) => {
  const result = await query(
    `
      INSERT INTO product_images (filename, content_type, data)
      VALUES ($1, $2, $3)
      RETURNING id, filename, content_type
    `,
    [file.originalname || 'product-image', file.mimetype || 'application/octet-stream', file.buffer]
  );
  return result.rows[0];
};

const getProductImage = async (id) => {
  const result = await query('SELECT * FROM product_images WHERE id = $1', [id]);
  return result.rows[0];
};

const ready = () => initPromise;

module.exports = {
  ready,
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
  createProductImage,
  getProductImage,
};
