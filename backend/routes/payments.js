const express = require('express');
const db = require('../database');
const authenticate = require('../middleware/auth');
const authorizeAdmin = require('../middleware/authorizeAdmin');

const router = express.Router();
const ADMIN_MOMO_NUMBER = process.env.ADMIN_MOMO_NUMBER || '233240290207';

function createOrderNumber(orderId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `FSG-${datePart}-${String(orderId).padStart(4, '0')}`;
}

// Confirm mobile money order and create order record
router.post('/confirm-momo', async (req, res) => {
  try {
    const { name, phone, shippingAddress, city, items } = req.body;

    // Validate required fields
    if (!name || !phone || !shippingAddress || !city) {
      return res.status(400).json({ 
        message: 'Missing required contact information',
        missing: {
          name: !name,
          phone: !phone,
          shippingAddress: !shippingAddress,
          city: !city
        }
      });
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
        quantity: item.quantity,
        size: item.size ? String(item.size).trim().toLowerCase() : '',
        price: product.price || 0,
      });
    }

    const order = await db.insertItem('orders', {
      user_id: req.user?.id || null,
      total,
      status: 'pending',
      shipping_address: JSON.stringify({ name, phone, address: shippingAddress, city }),
      payment_method: 'momo',
      currency: 'GHS',
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

      // Update stock - use the accumulated reduction to avoid race condition
      const product = await db.findById('products', item.product_id);
      const newStock = Math.max(0, (product.stock || 0) - item.quantity);
      await db.updateItem('products', item.product_id, {
        stock: newStock,
      });
    }

    // Clear cart if user is logged in
    if (req.user?.id) {
      const cartItems = await db.getCollection('cart_items');
      const userCart = cartItems.filter(item => item.user_id === req.user.id);
      for (const cartItem of userCart) {
        await db.removeItem('cart_items', cartItem.id);
      }
    }

    res.json({
      order: {
        id: order.id,
        order_number: orderNumber,
        total: order.total,
        status: order.status,
        shipping_address: order.shipping_address,
        created_at: order.created_at,
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
router.get('/orders/all', authenticate, authorizeAdmin, async (req, res) => {
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

    await db.updateItem('orders', id, { status: status.toLowerCase() });

    res.json({ message: 'Order status updated successfully', order: { ...order, status: status.toLowerCase() } });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
});

module.exports = router;
