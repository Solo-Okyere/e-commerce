const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authenticate = require('../middleware/auth');
const { sendOrderNotificationEmails } = require('../services/emailService');

const router = express.Router();
const ADMIN_MOMO_NUMBER = process.env.ADMIN_MOMO_NUMBER || '233240290207';

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
    console.error('Ignoring invalid optional auth token during checkout:', error.message);
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Confirm mobile money order and create order record
router.post('/confirm-momo', async (req, res) => {
  try {
    const optionalUser = getOptionalUser(req);
    const { name, phone, email, shippingAddress, city, items } = req.body;
    const customerEmail = String(email || optionalUser?.email || '').trim().toLowerCase();

    // Validate required fields
    if (!name || !phone || !customerEmail || !shippingAddress || !city) {
      return res.status(400).json({ 
        message: 'Missing required contact information',
        missing: {
          name: !name,
          phone: !phone,
          email: !customerEmail,
          shippingAddress: !shippingAddress,
          city: !city
        }
      });
    }

    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ message: 'A valid email address is required for order confirmation.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        message: 'Cart is empty. Add items to cart before checkout.' 
      });
    }

    let total = 0;
    const orderItems = [];

    for (const item of items) {
      // Validate item structure
      if (!item.product_id) {
        return res.status(400).json({ 
          message: `Invalid item in cart: missing product_id`,
          item 
        });
      }

      // Check if product exists and has enough stock
      const product = await db.findById('products', item.product_id);
      if (!product) {
        return res.status(400).json({ 
          message: `Product ${item.product_id} not found in database` 
        });
      }

      const productStock = product.stock || 0;
      if (productStock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${productStock}, Required: ${item.quantity}` 
        });
      }

      total += (product.price || 0) * item.quantity;
      orderItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        size: item.size ? String(item.size).trim().toLowerCase() : '',
        price: product.price || 0,
      });
    }

    const shippingDetails = { name, phone, email: customerEmail, address: shippingAddress, city };
    const order = await db.insertItem('orders', {
      user_id: optionalUser?.id || null,
      customer_email: customerEmail,
      total,
      status: 'pending',
      shipping_address: JSON.stringify(shippingDetails),
      payment_method: 'momo',
      currency: 'GHS',
    });

    const orderNumber = createOrderNumber(order.id);
    await db.updateItem('orders', order.id, { order_number: orderNumber });
    const savedOrder = await db.findById('orders', order.id);

    for (const item of orderItems) {
      await db.insertItem('order_items', {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        size: item.size,
        price: item.price,
      });

      // Update stock - use the accumulated reduction to avoid race condition
      const product = await db.findById('products', item.product_id);
      const newStock = Math.max(0, (product.stock || 0) - item.quantity);
      await db.updateItem('products', item.product_id, {
        stock: newStock,
      });
    }

    // Clear cart if user is logged in
    if (optionalUser?.id) {
      const cartItems = await db.getCollection('cart_items');
      const userCart = cartItems.filter(item => item.user_id === optionalUser.id);
      for (const cartItem of userCart) {
        await db.removeItem('cart_items', cartItem.id);
      }
    }

    try {
      await sendOrderNotificationEmails(savedOrder, orderItems, shippingDetails);
    } catch (emailError) {
      console.error(`Order ${savedOrder.id} was created, but email notification processing failed:`, emailError);
    }

    res.json({
      orderId: order.id,
      orderNumber,
      order: {
        id: savedOrder.id,
        order_number: savedOrder.order_number,
        total: savedOrder.total,
        status: savedOrder.status,
        shipping_address: savedOrder.shipping_address,
        created_at: savedOrder.created_at,
      },
      items: orderItems,
      momoNumber: ADMIN_MOMO_NUMBER,
      message: `Send GH₵${total.toFixed(2)} to ${ADMIN_MOMO_NUMBER} via mobile money and then confirm your order.`,
    });
  } catch (error) {
    console.error('Mobile money confirmation error:', error);
    res.status(500).json({ message: 'Failed to process mobile money order', error: error.message });
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

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const orderItems = await db.getCollection('order_items');
        const items = orderItems
          .filter(item => item.order_id === order.id)
          .map(async (item) => {
            const product = await db.findById('products', item.product_id);
            return {
              ...item,
              product: product ? {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
              } : null,
            };
          });

        const resolvedItems = await Promise.all(items);

        return {
          ...order,
          items: resolvedItems,
        };
      })
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
        const orderItems = await db.getCollection('order_items');
        const items = orderItems
          .filter(item => item.order_id === order.id)
          .map(async (item) => {
            const product = await db.findById('products', item.product_id);
            return {
              ...item,
              product: product ? {
                id: product.id,
                name: product.name,
                image_url: product.image_url,
              } : null,
            };
          });

        const resolvedItems = await Promise.all(items);
        const user = users.find(u => u.id === order.user_id);

        return {
          ...order,
          user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
          items: resolvedItems,
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

    const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ 
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` 
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
