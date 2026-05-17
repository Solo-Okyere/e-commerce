const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await db.getCollection('users');
    const orders = await db.getCollection('orders');

    const usersWithOrderCount = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      orderCount: orders.filter((order) => order.user_id === user.id).length,
    }));

    res.json(usersWithOrderCount);
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router;
