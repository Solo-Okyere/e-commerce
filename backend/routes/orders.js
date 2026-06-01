const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authenticate = require('../middleware/auth');

const router = express.Router();

function createOrderNumber(orderId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FSG-${datePart}-${String(orderId).padStart(4, '0')}`;
}

function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (error) {
    console.error('Ignoring invalid optional auth token during order creation:', error.message);
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

router.get('/', authenticate, async (req, res) => {
  const orders = await db.getCollection('orders');
  const userOrders = orders.filter((order) => order.user_id === req.user.id);
  res.json(userOrders);
});

router.post('/', async (req, res) => {
  const optionalUser = getOptionalUser(req);
  const { items, total, shipping_address, payment_method, email } = req.body;
  if (!Array.isArray(items) || items.length === 0 || total == null) {
    return res.status(400).json({ message: 'Order items and total are required' });
  }

  let shippingDetails = {};
  try {
    shippingDetails =
      typeof shipping_address === 'string'
        ? JSON.parse(shipping_address || '{}')
        : shipping_address || {};
  } catch {
    return res.status(400).json({ message: 'Shipping address must be valid JSON.' });
  }
  const customerEmail = String(email || shippingDetails.email || optionalUser?.email || '').trim().toLowerCase();

  if (!customerEmail || !isValidEmail(customerEmail)) {
    return res.status(400).json({ message: 'A valid customer email is required for order confirmation.' });
  }

  const order = await db.insertItem('orders', {
    user_id: optionalUser?.id || null,
    customer_email: customerEmail,
    total: Number(total),
    status: 'pending',
    shipping_address: JSON.stringify({ ...shippingDetails, email: customerEmail }),
    payment_method: payment_method || 'unknown',
    currency: 'GHS',
  });

  const orderNumber = createOrderNumber(order.id);
  await db.updateItem('orders', order.id, { order_number: orderNumber });
  const savedOrder = await db.findById('orders', order.id);

  const orderItems = await Promise.all(
    items.map(async (item) => {
      const product = await db.findById('products', item.product_id);
      const price = Number(item.price ?? product?.price ?? 0);
      return db.insertItem('order_items', {
        order_id: order.id,
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        size: item.size ? String(item.size).trim().toLowerCase() : '',
        price,
      }).then((orderItem) => ({
        ...orderItem,
        product_name: product?.name || 'Product',
      }));
    })
  );

  const cartItems = await db.getCollection('cart_items');
  if (optionalUser?.id) {
    await Promise.all(
      cartItems
        .filter((cartItem) => cartItem.user_id === optionalUser.id)
        .map(async (cartItem) => db.removeItem('cart_items', cartItem.id))
    );
  }

  res.status(201).json({ order: savedOrder, order_items: orderItems });
});

module.exports = router;
