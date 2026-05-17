const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  const categories = await db.getCollection('categories');
  res.json(categories);
});

router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const newCategory = await db.insertItem('categories', {
    name,
    description: description || '',
  });

  res.status(201).json(newCategory);
});

module.exports = router;
