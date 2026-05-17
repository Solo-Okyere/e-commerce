const express = require('express');
const db = require('../database');
const multer = require('multer');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function normalizeProductImage(product, req) {
  if (!product) return product;
  if (product.image_url && product.image_url.startsWith('/uploads')) {
    return { ...product, image_url: `${getBaseUrl(req)}${product.image_url}` };
  }
  return product;
}

function normalizeSizes(sizes) {
  const allowedSizes = ['s', 'm', 'l', 'xl', 'xxl'];
  if (typeof sizes !== 'string') return '';

  const cleaned = sizes
    .split(',')
    .map((size) => size.trim().toLowerCase())
    .filter((size) => allowedSizes.includes(size));

  return [...new Set(cleaned)].join(',');
}

router.get('/', async (req, res) => {
  const products = await db.getCollection('products');
  res.json(products.map((product) => normalizeProductImage(product, req)));
});

router.get('/:id', async (req, res) => {
  const product = await db.findById('products', req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(normalizeProductImage(product, req));
});

router.post('/', upload.single('image'), async (req, res) => {
  const { name, description, price, image_url, category_id, stock, sizes } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ message: 'Product name and price are required' });
  }

  let finalImageUrl = null;
  if (req.file) {
    finalImageUrl = `/uploads/products/${req.file.filename}`;
  } else if (typeof image_url === 'string' && image_url.trim()) {
    finalImageUrl = image_url.trim();
  }

  const newProduct = await db.insertItem('products', {
    name,
    description: description || '',
    price: Number(price),
    image_url: finalImageUrl,
    category_id: category_id ? Number(category_id) : null,
    stock: stock != null ? Number(stock) : 0,
    sizes: normalizeSizes(sizes),
  });

  res.status(201).json(normalizeProductImage(newProduct, req));
});

router.put('/:id', upload.single('image'), async (req, res) => {
  const { image_url, ...rest } = req.body;
  const updateData = { ...rest };

  if ('sizes' in updateData) {
    updateData.sizes = normalizeSizes(updateData.sizes);
  }

  if (req.file) {
    updateData.image_url = `/uploads/products/${req.file.filename}`;
  } else if (typeof image_url === 'string') {
    updateData.image_url = image_url.trim() || null;
  }

  const updated = await db.updateItem('products', req.params.id, updateData);
  if (!updated) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(normalizeProductImage(updated, req));
});

router.delete('/:id', async (req, res) => {
  const deleted = await db.removeItem('products', req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.status(204).send();
});

module.exports = router;
