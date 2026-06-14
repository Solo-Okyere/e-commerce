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
  } catch {
    return value;
  }
}

const pool = new Pool({ connectionString: normalizeConnectionString(process.env.DATABASE_URL) });

const PRODUCTS = [
  // ── Women (category_id: 1) ──────────────────────────────────────────────
  { name: 'Silk Wrap Blouse', description: 'Luxurious silk blouse with a self-tie wrap detail for a flattering silhouette.', price: 65.99, category_id: 1, stock: 18, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=400&q=80' },
  { name: 'High-Waist Linen Pants', description: 'Breathable linen trousers with a high waist and wide leg for effortless elegance.', price: 55.00, category_id: 1, stock: 14, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4f8d?w=400&q=80' },
  { name: 'Satin Evening Gown', description: 'Floor-length satin gown with a cowl neckline — perfect for formal occasions.', price: 149.99, category_id: 1, stock: 6, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1566479179817-3b5b3c1e8b37?w=400&q=80' },
  { name: 'Ruffled Mini Skirt', description: 'Playful tiered ruffle skirt in a flattering A-line cut.', price: 42.00, category_id: 1, stock: 20, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1583496661160-fb5218afa9a3?w=400&q=80' },
  { name: 'Off-Shoulder Jumpsuit', description: 'Chic off-shoulder jumpsuit with wide-leg trousers and a cinched waist.', price: 89.99, category_id: 1, stock: 10, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80' },
  { name: 'Pleated Maxi Skirt', description: 'Flowing pleated maxi skirt in a lightweight chiffon fabric with an elastic waistband.', price: 58.00, category_id: 1, stock: 15, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80' },
  { name: 'Fitted Blazer', description: 'Structured single-button blazer with a nipped waist for a polished power look.', price: 95.00, category_id: 1, stock: 12, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80' },
  { name: 'Ribbed Knit Sweater', description: 'Cosy ribbed-knit crew-neck sweater in a relaxed fit, ideal for layering.', price: 48.99, category_id: 1, stock: 22, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&q=80' },
  { name: 'Wide-Leg Trousers', description: 'Tailored wide-leg trousers with a pressed crease and side-zip closure.', price: 62.00, category_id: 1, stock: 16, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80' },
  { name: 'Floral Print Blouse', description: 'Lightweight georgette blouse with an all-over floral print and relaxed hem.', price: 39.99, category_id: 1, stock: 25, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80' },
  { name: 'Bodycon Dress', description: 'Stretchy midi bodycon dress that hugs every curve with confident style.', price: 55.00, category_id: 1, stock: 14, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=400&q=80' },
  { name: 'Wrap Maxi Dress', description: 'Versatile wrap-style maxi dress with adjustable tie, suitable for day or evening.', price: 79.99, category_id: 1, stock: 11, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80' },
  { name: 'Puff Sleeve Top', description: 'Statement puff-sleeve top in a crisp poplin fabric with pearl button detail.', price: 35.00, category_id: 1, stock: 19, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1485218126466-34e6392ec754?w=400&q=80' },
  { name: 'Slip Dress', description: 'Satin-finish slip dress with adjustable spaghetti straps and lace trim hem.', price: 49.99, category_id: 1, stock: 13, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=400&q=80' },
  { name: 'Trench Coat', description: 'Classic double-breasted trench coat with belted waist and water-resistant finish.', price: 125.00, category_id: 1, stock: 8, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=400&q=80' },
  { name: 'Knit Cardigan', description: 'Long open-front cardigan in a soft cable-knit with patch pockets.', price: 58.99, category_id: 1, stock: 17, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80' },
  { name: 'Smocked Sundress', description: 'Breezy smocked-bodice sundress with adjustable tie straps and tiered skirt.', price: 44.00, category_id: 1, stock: 21, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80' },
  { name: 'Tailored Shorts', description: 'High-waist tailored shorts with front pleats and a relaxed wide-leg opening.', price: 38.00, category_id: 1, stock: 18, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1591195853828-11db59a44f43?w=400&q=80' },
  { name: 'Lace Camisole Top', description: 'Delicate lace-trimmed camisole with adjustable straps, perfect for layering or solo wear.', price: 29.99, category_id: 1, stock: 24, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=400&q=80' },

  // ── Men (category_id: 2) ────────────────────────────────────────────────
  { name: 'Oxford Button-Down Shirt', description: 'Crisp cotton Oxford shirt with a button-down collar, great for smart-casual dressing.', price: 45.00, category_id: 2, stock: 20, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=400&q=80' },
  { name: 'Slim-Fit Chinos', description: 'Stretch-cotton slim-fit chinos with a mid-rise waist and tapered leg.', price: 55.00, category_id: 2, stock: 18, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&q=80' },
  { name: 'Linen Summer Shirt', description: 'Relaxed-fit linen shirt with a notched collar and chest pocket, ideal for warm days.', price: 42.99, category_id: 2, stock: 15, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&q=80' },
  { name: 'Graphic Tee', description: 'Heavyweight cotton tee with an original graphic print — a streetwear essential.', price: 25.00, category_id: 2, stock: 30, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80' },
  { name: 'Jogger Pants', description: 'French terry joggers with a drawstring waist, ribbed cuffs, and side zip pockets.', price: 48.00, category_id: 2, stock: 16, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=400&q=80' },
  { name: 'Polo Shirt', description: 'Piqué cotton polo with a two-button placket and embroidered logo at chest.', price: 38.99, category_id: 2, stock: 22, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&q=80' },
  { name: 'Bomber Jacket', description: 'Satin-finish bomber jacket with ribbed cuffs, snap button closure, and side pockets.', price: 89.99, category_id: 2, stock: 9, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1548126032-079a0fb0099d?w=400&q=80' },
  { name: 'Tailored Suit Jacket', description: 'Slim-fit single-breasted suit jacket in a premium wool-blend fabric.', price: 135.00, category_id: 2, stock: 7, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80' },
  { name: 'Cargo Shorts', description: 'Relaxed-fit cargo shorts with multiple utility pockets and a drawstring waist.', price: 42.00, category_id: 2, stock: 20, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1591195853828-11db59a44f43?w=400&q=80' },
  { name: 'Striped Long-Sleeve Shirt', description: 'Breton-stripe long-sleeve top in a soft jersey fabric — a timeless classic.', price: 35.99, category_id: 2, stock: 17, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=400&q=80' },
  { name: 'Slim-Fit Jeans', description: 'Dark-wash slim-fit jeans with stretch denim for all-day comfort.', price: 65.00, category_id: 2, stock: 19, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80' },
  { name: 'Hooded Sweatshirt', description: 'Midweight pullover hoodie with a kangaroo pocket and adjustable drawstring.', price: 55.00, category_id: 2, stock: 23, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=400&q=80' },
  { name: 'Wool Overcoat', description: 'Classic double-breasted wool overcoat with notched lapels — refined cold-weather dressing.', price: 145.00, category_id: 2, stock: 6, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=400&q=80' },
  { name: 'V-Neck T-Shirt', description: 'Soft pima-cotton V-neck tee with a semi-fitted silhouette, available in multiple colours.', price: 22.99, category_id: 2, stock: 35, sizes: 's,m,l,xl,xxl', image_url: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=400&q=80' },

  // ── Boutique (category_id: 3) ────────────────────────────────────────────
  { name: 'Leather Tote Bag', description: 'Spacious full-grain leather tote with internal zip pocket and gold-tone hardware.', price: 95.00, category_id: 3, stock: 10, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80' },
  { name: 'Silk Scarf', description: 'Hand-rolled 100% silk twill scarf with a vibrant geometric print — wear it many ways.', price: 45.00, category_id: 3, stock: 20, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1601924351433-ad1e0012a0f2?w=400&q=80' },
  { name: 'Gold Chain Necklace', description: 'Chunky 18k gold-plated curb-link chain necklace — bold and versatile.', price: 38.99, category_id: 3, stock: 15, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80' },
  { name: 'Beaded Bracelet Set', description: 'Set of 5 handcrafted beaded bracelets in complementary earth tones.', price: 28.00, category_id: 3, stock: 25, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1573408301185-9519f94438d8?w=400&q=80' },
  { name: 'Suede Crossbody Bag', description: 'Compact suede crossbody with an adjustable strap and magnetic snap closure.', price: 79.99, category_id: 3, stock: 12, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80' },
  { name: 'Pearl Drop Earrings', description: 'Freshwater pearl drop earrings with sterling silver posts — effortlessly classic.', price: 32.00, category_id: 3, stock: 18, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80' },
  { name: 'Wide-Brim Sun Hat', description: 'Woven raffia wide-brim hat with a grosgrain ribbon trim — the ultimate summer accessory.', price: 42.99, category_id: 3, stock: 14, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1529958030586-3aae4ca485ff?w=400&q=80' },
  { name: 'Leather Belt', description: 'Full-grain leather belt with a polished square buckle, available in tan and black.', price: 35.00, category_id: 3, stock: 22, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80' },
  { name: 'Crystal Hair Clips Set', description: 'Set of 4 oversized crystal-embellished hair clips in mixed tortoiseshell and clear.', price: 18.99, category_id: 3, stock: 30, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80' },
  { name: 'Woven Straw Clutch', description: 'Hand-woven straw clutch with a satin lining and gold-tone clasp closure.', price: 55.00, category_id: 3, stock: 11, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400&q=80' },
  { name: 'Layered Necklace Set', description: 'Three-piece layered necklace set in gold tone — wear together or separately.', price: 45.99, category_id: 3, stock: 16, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=80' },
  { name: 'Embroidered Canvas Tote', description: 'Sturdy canvas tote with floral embroidery, interior pockets, and long shoulder straps.', price: 38.00, category_id: 3, stock: 20, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=400&q=80' },
  { name: 'Tortoiseshell Sunglasses', description: 'Oversized tortoiseshell acetate sunglasses with UV400 polarised lenses.', price: 48.99, category_id: 3, stock: 18, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80' },
  { name: 'Leather Card Wallet', description: 'Slim bifold card wallet in full-grain leather with 6 card slots and a cash compartment.', price: 28.00, category_id: 3, stock: 25, sizes: 's,m,l,xl', image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80' },
];

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  const existing = rows[0].count;

  if (existing >= 50) {
    console.log(`Already ${existing} products — nothing to insert.`);
    await pool.end();
    return;
  }

  const toInsert = PRODUCTS.slice(0, 50 - existing);
  console.log(`Found ${existing} products. Inserting ${toInsert.length} more...`);

  for (const p of toInsert) {
    await pool.query(
      `INSERT INTO products (name, description, price, image_url, category_id, stock, sizes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.name, p.description, p.price, p.image_url, p.category_id, p.stock, p.sizes]
    );
    console.log(`  ✓ ${p.name}`);
  }

  const { rows: after } = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  console.log(`Done — ${after[0].count} products in database.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
