const express = require('express');
const db = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();

async function attachProductDetails(cartItem) {
  const product = await db.findById('products', cartItem.product_id);
  return {
    ...cartItem,
    product: product ? {
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    } : undefined,
  };
}

router.get('/', authenticate, async (req, res) => {
  const items = await db.getCollection('cart_items');
  const userItems = items.filter((item) => item.user_id === req.user.id);
  const cartWithProducts = await Promise.all(userItems.map(attachProductDetails));
  res.json(cartWithProducts);
});

router.post('/', authenticate, async (req, res) => {
  const { product_id, quantity, size } = req.body;
  if (!product_id || !quantity || !size) {
    return res.status(400).json({ message: 'Product ID, quantity, and size are required' });
  }

  const product = await db.findById('products', product_id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const items = await db.getCollection('cart_items');
  const normalizedSize = String(size).trim().toLowerCase();
  const existingItem = items.find((item) =>
    item.user_id === req.user.id &&
    item.product_id === Number(product_id) &&
    item.size === normalizedSize
  );

  let cartItem;
  if (existingItem) {
    cartItem = await db.updateItem('cart_items', existingItem.id, {
      quantity: Number(existingItem.quantity) + Number(quantity),
    });
  } else {
    cartItem = await db.insertItem('cart_items', {
      user_id: req.user.id,
      product_id: Number(product_id),
      quantity: Number(quantity),
      size: normalizedSize,
    });
  }

  const result = await attachProductDetails(cartItem);
  res.status(201).json(result);
});

router.put('/:id', authenticate, async (req, res) => {
  const { quantity } = req.body;
  if (quantity == null) {
    return res.status(400).json({ message: 'Quantity is required' });
  }

  const item = await db.findById('cart_items', req.params.id);
  if (!item || item.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  const updated = await db.updateItem('cart_items', req.params.id, {
    quantity: Number(quantity),
  });
  const result = await attachProductDetails(updated);
  res.json(result);
});

router.delete('/:id', authenticate, async (req, res) => {
  const item = await db.findById('cart_items', req.params.id);
  if (!item || item.user_id !== req.user.id) {
    return res.status(404).json({ message: 'Cart item not found' });
  }

  await db.removeItem('cart_items', req.params.id);
  res.status(204).send();
});

module.exports = router;
