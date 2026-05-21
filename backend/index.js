console.log('Starting FOSOGO Closet API server...');

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./database');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Ensure upload directories exist
const uploadsDir = path.resolve(__dirname, 'uploads');
const productsUploadDir = path.join(uploadsDir, 'products');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(productsUploadDir)) fs.mkdirSync(productsUploadDir, { recursive: true });

// CORS — allow only the Render frontend and localhost admin port
const ALLOWED_ORIGINS = [
  ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'https://fosogo-na.onrender.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'http://localhost:8080',
  'http://localhost:3000',
];
function corsOrigin(origin, cb) {
  // Allow same-origin, requests with no Origin header (curl, Postman), and specified origins
  let isRenderOrigin = false;
  try {
    isRenderOrigin = Boolean(origin && new URL(origin).hostname.endsWith('.onrender.com'));
  } catch {
    isRenderOrigin = false;
  }

  if (!origin || ALLOWED_ORIGINS.includes(origin) || isRenderOrigin) {
    cb(null, true);
  } else {
    cb(new Error('Not allowed by CORS'));
  }
}

// Middleware
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// API routes
app.get('/', (req, res) => {
  res.send('FOSOGO Closet API');
});
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
