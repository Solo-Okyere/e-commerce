const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authenticate = require('../middleware/auth');
const { sendOrderNotificationEmails } = require('../services/emailService');
const {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  toMinorUnit,
} = require('../services/paystackService');

const router = express.Router();

function createOrderNumber(orderId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FSG-${datePart}-${String(orderId).padStart(4, '0')}`;
}

function createPaymentReference(orderId) {
  return `FSG-${orderId}-${Date.now()}`;
}

function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (error) {
    console.error('Ignoring invalid optional auth token during checkout:', error.message);
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function sanitizeCheckoutKey(value) {
  const checkoutKey = String(value || '').trim();
  return checkoutKey && checkoutKey.length <= 120 ? checkoutKey : null;
}

function getFrontendCallbackUrl() {
  const callbackUrl = String(process.env.PAYSTACK_CALLBACK_URL || '').trim();
  if (callbackUrl) {
    if (callbackUrl.includes('/payment/success')) {
      return callbackUrl.replace(/\/payment\/success\/?$/, '/payment/callback');
    }
    return callbackUrl;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl.replace(/\/$/, '')}/payment/callback`;
}

function parseShippingAddress(order) {
  try {
    return JSON.parse(order.shipping_address || '{}');
  } catch {
    return {};
  }
}

async function getOrderItemsForEmail(orderId) {
  const orderItems = await db.getCollection('order_items');
  return Promise.all(
    orderItems
      .filter((item) => item.order_id === orderId)
      .map(async (item) => {
        const product = await db.findById('products', item.product_id);
        return {
          ...item,
          product_name: product?.name || 'Product',
          product: product
            ? {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
              }
            : null,
        };
      })
  );
}

async function decrementStockForPaidOrder(orderId) {
  const orderItems = await db.getCollection('order_items');
  const items = orderItems.filter((item) => item.order_id === orderId);

  for (const item of items) {
    const product = await db.findById('products', item.product_id);
    if (!product) continue;

    const newStock = Math.max(0, Number(product.stock || 0) - Number(item.quantity || 0));
    await db.updateItem('products', item.product_id, { stock: newStock });
  }
}

async function clearUserCart(userId) {
  if (!userId) return;

  const cartItems = await db.getCollection('cart_items');
  const userCart = cartItems.filter((item) => item.user_id === userId);
  for (const cartItem of userCart) {
    await db.removeItem('cart_items', cartItem.id);
  }
}

async function createOrReusePendingOrder(req) {
  const optionalUser = getOptionalUser(req);
  const { name, phone, email, shippingAddress, city, items, checkoutKey } = req.body;
  const customerEmail = String(email || optionalUser?.email || '').trim().toLowerCase();
  const normalizedCheckoutKey = sanitizeCheckoutKey(checkoutKey);

  if (!name || !phone || !customerEmail || !shippingAddress || !city) {
    const error = new Error('Missing required checkout information.');
    error.statusCode = 400;
    error.details = {
      name: !name,
      phone: !phone,
      email: !customerEmail,
      shippingAddress: !shippingAddress,
      city: !city,
    };
    throw error;
  }

  if (!isValidEmail(customerEmail)) {
    const error = new Error('A valid email address is required for payment.');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Cart is empty. Add items to cart before checkout.');
    error.statusCode = 400;
    throw error;
  }

  const existingOrder = normalizedCheckoutKey ? await db.findOrderByCheckoutKey(normalizedCheckoutKey) : null;
  if (existingOrder) {
    return { order: existingOrder, items: await getOrderItemsForEmail(existingOrder.id), reused: true };
  }

  let total = 0;
  const orderItems = [];

  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error('Invalid cart item.');
      error.statusCode = 400;
      throw error;
    }

    const product = await db.findById('products', productId);
    if (!product) {
      const error = new Error(`Product ${productId} not found in database.`);
      error.statusCode = 400;
      throw error;
    }

    if (Number(product.stock || 0) < quantity) {
      const error = new Error(`Insufficient stock for ${product.name}. Available: ${product.stock || 0}, Required: ${quantity}`);
      error.statusCode = 400;
      throw error;
    }

    total += Number(product.price || 0) * quantity;
    orderItems.push({
      product_id: productId,
      product_name: product.name,
      quantity,
      size: item.size ? String(item.size).trim().toLowerCase() : '',
      price: Number(product.price || 0),
    });
  }

  const shippingDetails = { name, phone, email: customerEmail, address: shippingAddress, city };
  const order = await db.insertItem('orders', {
    user_id: optionalUser?.id || null,
    customer_email: customerEmail,
    checkout_key: normalizedCheckoutKey,
    total,
    status: 'pending',
    shipping_address: JSON.stringify(shippingDetails),
    payment_method: 'paystack_mobile_money',
    payment_provider: 'paystack',
    payment_status: 'pending',
    currency: process.env.PAYSTACK_CURRENCY || 'GHS',
  });

  const orderNumber = createOrderNumber(order.id);
  await db.updateItem('orders', order.id, { order_number: orderNumber });

  for (const item of orderItems) {
    await db.insertItem('order_items', {
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size,
      price: item.price,
    });
  }

  const savedOrder = await db.findById('orders', order.id);
  return { order: savedOrder, items: orderItems, reused: false };
}

async function sendPaidOrderEmails(order) {
  const items = await getOrderItemsForEmail(order.id);
  const shippingAddress = parseShippingAddress(order);

  try {
    await sendOrderNotificationEmails(order, items, shippingAddress);
  } catch (emailError) {
    console.error(`Order ${order.id} was paid, but email notification processing failed:`, emailError);
  }
}

async function markOrderPaidFromPaystack(reference, paystackData) {
  const order = await db.findOrderByPaymentReference(reference);
  if (!order) {
    throw new Error(`No order found for Paystack reference ${reference}`);
  }

  const verifiedAmount = Number(paystackData.amount || 0);
  const expectedAmount = toMinorUnit(order.total);
  if (verifiedAmount !== expectedAmount) {
    await db.updateItem('orders', order.id, {
      status: 'failed',
      payment_status: 'amount_mismatch',
      payment_details: JSON.stringify(paystackData),
    });
    await db.updatePaymentTransaction(reference, {
      status: 'amount_mismatch',
      provider_response: JSON.stringify(paystackData),
    });
    throw new Error(`Paystack amount mismatch for order ${order.id}. Expected ${expectedAmount}, got ${verifiedAmount}.`);
  }

  if (order.status === 'paid') {
    await sendPaidOrderEmails(order);
    return db.findById('orders', order.id);
  }

  await decrementStockForPaidOrder(order.id);
  await db.updateItem('orders', order.id, {
    status: 'paid',
    payment_status: 'success',
    payment_details: JSON.stringify(paystackData),
    paid_at: new Date().toISOString(),
  });
  await db.updatePaymentTransaction(reference, {
    status: 'success',
    provider_response: JSON.stringify(paystackData),
  });
  await clearUserCart(order.user_id);

  const paidOrder = await db.findById('orders', order.id);
  await sendPaidOrderEmails(paidOrder);
  return paidOrder;
}

async function markOrderFailedFromPaystack(reference, paystackData) {
  const order = await db.findOrderByPaymentReference(reference);
  if (!order || order.status === 'paid') return order;

  await db.updateItem('orders', order.id, {
    status: 'failed',
    payment_status: paystackData?.status || 'failed',
    payment_details: JSON.stringify(paystackData || {}),
  });
  await db.updatePaymentTransaction(reference, {
    status: paystackData?.status || 'failed',
    provider_response: JSON.stringify(paystackData || {}),
  });

  return db.findById('orders', order.id);
}

async function initializePaystackPayment(req, res) {
  try {
    const { order } = await createOrReusePendingOrder(req);
    if (order.status === 'paid') {
      return res.json({ order, paid: true, message: 'Order is already paid.' });
    }

    const existingTransactions = await db.getCollection('payment_transactions');
    const existingTransaction = existingTransactions.find(
      (transaction) =>
        transaction.order_id === order.id &&
        transaction.status === 'pending' &&
        transaction.authorization_url
    );

    if (existingTransaction) {
      return res.json({
        order,
        reference: existingTransaction.reference,
        authorizationUrl: existingTransaction.authorization_url,
        accessCode: existingTransaction.access_code,
      });
    }

    const shippingAddress = parseShippingAddress(order);
    const reference = createPaymentReference(order.id);
    const response = await initializeTransaction({
      email: order.customer_email,
      amount: order.total,
      phone: shippingAddress.phone,
      reference,
      callbackUrl: getFrontendCallbackUrl(),
      order,
    });

    await db.updateItem('orders', order.id, {
      status: 'pending',
      payment_provider: 'paystack',
      payment_method: 'paystack_mobile_money',
      payment_reference: reference,
      payment_status: 'initialized',
    });
    await db.upsertPaymentTransaction({
      order_id: order.id,
      provider: 'paystack',
      reference,
      status: 'pending',
      amount: order.total,
      currency: order.currency || 'GHS',
      authorization_url: response.data.authorization_url,
      access_code: response.data.access_code,
      provider_response: JSON.stringify(response.data),
    });

    res.json({
      order: await db.findById('orders', order.id),
      reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to initialize Paystack payment',
      missing: error.details,
    });
  }
}

// Create a pending order and initialize Paystack Mobile Money checkout.
router.post('/paystack/initialize', initializePaystackPayment);

// Backward-compatible route name for older frontend clients.
router.post('/confirm-momo', initializePaystackPayment);

router.get('/paystack/config', (req, res) => {
  const secretKey = String(process.env.PAYSTACK_SECRET_KEY || '');
  const keyType = secretKey.startsWith('sk_live_')
    ? 'live'
    : secretKey.startsWith('sk_test_')
    ? 'test'
    : secretKey
    ? 'unknown'
    : null;

  res.json({
    paystackConfigured: Boolean(secretKey),
    keyType,
    callbackUrl: getFrontendCallbackUrl(),
    paystackBaseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  });
});

router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await verifyTransaction(reference);
    const paystackData = response.data;

    if (paystackData.status === 'success') {
      const order = await markOrderPaidFromPaystack(reference, paystackData);
      return res.json({ status: 'success', order, payment: paystackData });
    }

    const order = await markOrderFailedFromPaystack(reference, paystackData);
    res.status(400).json({
      status: paystackData.status || 'failed',
      order,
      message: paystackData.gateway_response || 'Payment was not successful.',
    });
  } catch (error) {
    console.error('Paystack verification error:', error);
    res.status(500).json({ message: error.message || 'Failed to verify payment' });
  }
});

router.post('/paystack/webhook', async (req, res) => {
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers['x-paystack-signature'];

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ message: 'Invalid Paystack webhook signature.' });
  }

  try {
    const event = req.body;
    const reference = event?.data?.reference;
    if (!reference) return res.status(200).json({ received: true });

    if (event.event === 'charge.success') {
      const response = await verifyTransaction(reference);
      if (response.data.status === 'success') {
        await markOrderPaidFromPaystack(reference, response.data);
      }
    } else if (event.event === 'charge.failed') {
      await markOrderFailedFromPaystack(reference, event.data);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing error:', error);
    res.status(200).json({ received: true });
  }
});

// Public: sync order statuses for locally stored guest/customer orders
router.post('/orders/statuses', async (req, res) => {
  try {
    const requestedOrders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    const orders = await db.getCollection('orders');

    const statuses = requestedOrders
      .map((requestedOrder) => {
        const id = Number(requestedOrder?.id);
        const orderNumber = typeof requestedOrder?.order_number === 'string' ? requestedOrder.order_number : null;
        const shippingAddress =
          typeof requestedOrder?.shipping_address === 'string' ? requestedOrder.shipping_address : null;
        const total = Number(requestedOrder?.total);

        const matchedOrder = orders.find((order) => {
          if (Number.isFinite(id) && order.id === id) return true;
          if (orderNumber && order.order_number === orderNumber) return true;
          return (
            shippingAddress &&
            Number.isFinite(total) &&
            order.shipping_address === shippingAddress &&
            Number(order.total) === total
          );
        });

        if (!matchedOrder) return null;

        return {
          localId: requestedOrder.id,
          id: matchedOrder.id,
          order_number: matchedOrder.order_number,
          status: matchedOrder.status,
        };
      })
      .filter(Boolean);

    res.json({ statuses });
  } catch (error) {
    console.error('Order status sync error:', error);
    res.status(500).json({ message: 'Failed to sync order statuses', error: error.message });
  }
});

// Get user's orders
router.get('/orders', authenticate, async (req, res) => {
  try {
    const orders = await db.getCollection('orders');
    const userOrders = orders.filter(order => order.user_id === req.user.id);

    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => ({
        ...order,
        items: await getOrderItemsForEmail(order.id),
      }))
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Admin: get all orders with customer details
router.get('/orders/all', async (req, res) => {
  try {
    const orders = await db.getCollection('orders');
    const users = await db.getCollection('users');

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const user = users.find(u => u.id === order.user_id);
        return {
          ...order,
          user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
          items: await getOrderItemsForEmail(order.id),
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch admin orders' });
  }
});

// Admin: update order status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const allowedStatuses = ['pending', 'processing', 'paid', 'failed', 'shipped', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      });
    }

    const order = await db.findById('orders', id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const normalizedStatus = status.toLowerCase();
    await db.updateItem('orders', id, { status: normalizedStatus });
    const updatedOrder = await db.findById('orders', id);

    res.json({ message: 'Order status updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
});

module.exports = router;
