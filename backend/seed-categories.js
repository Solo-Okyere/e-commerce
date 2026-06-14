'use strict';

const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const { loadEnv } = require('./config/env');

loadEnv();
neonConfig.webSocketConstructor = ws;

function normalizeConnectionString(value) {
  try {
    const url = new URL(value);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch { return value; }
}

const pool = new Pool({ connectionString: normalizeConnectionString(process.env.DATABASE_URL) });

const NEW_CATEGORIES = [
  { name: 'Footwear',    description: 'Sneakers, boots, heels and sandals for every occasion' },
  { name: 'Activewear',  description: 'Performance and lifestyle athletic wear' },
  { name: 'Kids',        description: 'Stylish clothing and accessories for children' },
];

const NEW_PRODUCTS = (ids) => [
  // ── Footwear ────────────────────────────────────────────────────────────
  { name: 'Classic White Sneakers',    description: 'Clean low-top canvas sneakers with a rubber sole — the everyday essential.',         price: 59.99, category_id: ids.Footwear,   stock: 25, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80' },
  { name: 'High-Top Canvas Shoes',     description: 'Retro high-top canvas trainers with metal eyelets and a cushioned insole.',          price: 49.99, category_id: ids.Footwear,   stock: 18, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1463100099107-aa0980c362e6?w=400&q=80' },
  { name: 'Leather Chelsea Boots',     description: 'Sleek pull-on Chelsea boots in full-grain leather with an elastic gore panel.',       price: 89.99, category_id: ids.Footwear,   stock: 10, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&q=80' },
  { name: 'Strappy Heeled Sandals',    description: 'Open-toe heeled sandals with adjustable ankle straps and a cushioned footbed.',      price: 55.00, category_id: ids.Footwear,   stock: 14, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80' },
  { name: 'Running Trainers',          description: 'Lightweight mesh running shoes with a responsive foam midsole and breathable upper.', price: 75.00, category_id: ids.Footwear,   stock: 20, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80' },
  { name: 'Platform Loafers',          description: 'Chunky platform loafers in vegan leather with a square toe and gold-tone bit.',       price: 65.00, category_id: ids.Footwear,   stock: 12, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1571908598047-f2f33c72bec1?w=400&q=80' },
  { name: 'Slip-On Mules',             description: 'Minimalist backless mules in soft suede with a block heel and almond toe.',           price: 42.00, category_id: ids.Footwear,   stock: 16, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1512374382149-233c42b6a83b?w=400&q=80' },

  // ── Activewear ──────────────────────────────────────────────────────────
  { name: 'High-Support Sports Bra',   description: 'Moisture-wicking high-support sports bra with a racerback and removable padding.',   price: 38.99, category_id: ids.Activewear, stock: 22, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80' },
  { name: 'Seamless Leggings',         description: 'Four-way stretch seamless leggings with a high waist and squat-proof fabric.',        price: 55.00, category_id: ids.Activewear, stock: 20, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80' },
  { name: 'Moisture-Wicking Run Top',  description: 'Ultra-light running top with mesh panels and reflective details for low-light runs.', price: 32.00, category_id: ids.Activewear, stock: 18, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80' },
  { name: 'Zip-Up Track Jacket',       description: 'Slim-fit zip-up track jacket in recycled polyester with contrast side stripes.',      price: 65.00, category_id: ids.Activewear, stock: 14, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80' },
  { name: 'Gym Shorts',                description: 'Quick-dry 5-inch gym shorts with a built-in liner and side zip pocket.',             price: 28.99, category_id: ids.Activewear, stock: 25, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=400&q=80' },
  { name: 'Yoga Pants',                description: 'Buttery-soft full-length yoga pants with a wide waistband and hidden pocket.',        price: 49.99, category_id: ids.Activewear, stock: 20, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&q=80' },

  // ── Kids ────────────────────────────────────────────────────────────────
  { name: 'Floral Puff Dress',         description: 'Sweet puff-sleeve dress in a bright floral print with a smocked bodice.',            price: 28.99, category_id: ids.Kids,       stock: 15, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&q=80' },
  { name: 'Denim Dungarees',           description: 'Classic denim dungarees with adjustable straps and front bib pocket.',               price: 35.00, category_id: ids.Kids,       stock: 12, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1519278409-1f56fdda7fe5?w=400&q=80' },
  { name: 'Kids Graphic Tee',          description: 'Soft 100% cotton tee with a fun graphic print, pre-shrunk for lasting fit.',         price: 18.00, category_id: ids.Kids,       stock: 30, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=400&q=80' },
  { name: 'Hooded Raincoat',           description: 'Waterproof hooded raincoat with taped seams and reflective strips for safety.',      price: 42.00, category_id: ids.Kids,       stock: 10, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=400&q=80' },
  { name: 'School Polo Shirt',         description: 'Durable piqué polo shirt with ribbed collar, easy-care and long-lasting.',           price: 15.99, category_id: ids.Kids,       stock: 40, sizes: 's,m,l,xl',     image_url: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=400&q=80' },
];

async function seed() {
  // Insert only missing categories
  const catResult = await pool.query('SELECT name FROM categories');
  const existing = new Set(catResult.rows.map((r) => r.name));

  const categoryIds = {};

  for (const cat of NEW_CATEGORIES) {
    if (existing.has(cat.name)) {
      const row = await pool.query('SELECT id FROM categories WHERE name=$1', [cat.name]);
      categoryIds[cat.name] = row.rows[0].id;
      console.log(`  Category already exists: ${cat.name} (id ${categoryIds[cat.name]})`);
    } else {
      const row = await pool.query(
        'INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING id',
        [cat.name, cat.description]
      );
      categoryIds[cat.name] = row.rows[0].id;
      console.log(`  ✓ Category: ${cat.name} (id ${categoryIds[cat.name]})`);
    }
  }

  // Insert products
  const products = NEW_PRODUCTS(categoryIds);
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, description, price, image_url, category_id, stock, sizes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.name, p.description, p.price, p.image_url, p.category_id, p.stock, p.sizes]
    );
    console.log(`  ✓ ${p.name}`);
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  console.log(`\nDone — ${rows[0].count} total products in database.`);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
