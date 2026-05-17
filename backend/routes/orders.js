const express = require('express');
const db = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const orders = await db.getCollection('orders');
  const userOrders = orders.filter((order) => order.user_id === req.user.id);
  res.json(userOrders);
});

router.post('/', async (req, res) => {
  const { items, total, shipping_address, payment_method } = req.body;
  if (!Array.isArray(items) || items.length === 0 || total == null) {
    return res.status(400).json({ message: 'Order items and total are required' });
  }

  const order = await db.insertItem('orders', {
    user_id: req.user?.id || null,
    total: Number(total),
    status: 'pending',
    shipping_address: JSON.stringify(shipping_address || {}),
    payment_method: payment_method || 'unknown',
  });

  const orderItems = await Promise.all(
    items.map(async (item) => {
      return db.insertItem('order_items', {
        order_id: order.id,
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        price: Number(item.price),
      });
    })
  );

  const cartItems = await db.getCollection('cart_items');
  if (req.user?.id) {
    await Promise.all(
      cartItems
        .filter((cartItem) => cartItem.user_id === req.user.id)
        .map(async (cartItem) => db.removeItem('cart_items', cartItem.id))
    );
  }

  res.status(201).json({ order, order_items: orderItems });
});

module.exports = router;
