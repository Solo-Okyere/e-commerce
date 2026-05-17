const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('../database');
const authenticate = require('../middleware/auth');

dotenv.config();
const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const users = await db.getCollection('users');
  if (users.find((user) => user.email === email)) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.insertItem('users', {
    name,
    email,
    password: hashedPassword,
    role: 'customer',
  });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const users = await db.getCollection('users');
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
});

router.get('/profile', authenticate, async (req, res) => {
  const user = await db.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

router.put('/profile', authenticate, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;

  const user = await db.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Verify current password if changing password
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to change password' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
  }

  // Check if email is already taken by another user
  if (email !== user.email) {
    const users = await db.getCollection('users');
    if (users.find((u) => u.email === email && u.id !== user.id)) {
      return res.status(409).json({ message: 'Email already in use' });
    }
  }

  const updates = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (newPassword) {
    updates.password = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length > 0) {
    await db.updateItem('users', req.user.id, updates);
  }

  // Get updated user
  const updatedUser = await db.findById('users', req.user.id);
  res.json({
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });
});

module.exports = router;
