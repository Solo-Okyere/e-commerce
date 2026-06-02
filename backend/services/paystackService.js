const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY ||
  (process.env.NODE_ENV === 'production'
    ? process.env.PAYSTACK_LIVE_SECRET_KEY
    : process.env.PAYSTACK_TEST_SECRET_KEY) ||
  process.env.PAYSTACK_LIVE_SECRET_KEY ||
  process.env.PAYSTACK_TEST_SECRET_KEY;
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'GHS';
const PAYSTACK_CHANNELS = (process.env.PAYSTACK_CHANNELS || 'mobile_money')
  .split(',')
  .map((channel) => channel.trim())
  .filter(Boolean);

function ensurePaystackConfigured() {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error(
      'Paystack secret key is not configured. Set PAYSTACK_SECRET_KEY, PAYSTACK_TEST_SECRET_KEY, or PAYSTACK_LIVE_SECRET_KEY in backend/.env or the deployment environment.'
    );
  }
}

function toMinorUnit(amount) {
  return Math.round(Number(amount || 0) * 100);
}

async function requestPaystack(path, options = {}) {
  ensurePaystackConfigured();

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Paystack request failed with status ${response.status}`);
  }

  return payload;
}

async function initializeTransaction({ email, amount, phone, reference, callbackUrl, order }) {
  const payload = {
    email,
    amount: toMinorUnit(amount),
    currency: order.currency || PAYSTACK_CURRENCY,
    reference,
    channels: PAYSTACK_CHANNELS,
    callback_url: callbackUrl,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      phone,
      custom_fields: [
        {
          display_name: 'Phone Number',
          variable_name: 'phone_number',
          value: phone,
        },
        {
          display_name: 'Order Number',
          variable_name: 'order_number',
          value: order.order_number,
        },
      ],
    },
  };

  return requestPaystack('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function verifyTransaction(reference) {
  return requestPaystack(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
}

function verifyWebhookSignature(rawBody, signature) {
  if (!PAYSTACK_SECRET_KEY || !rawBody || !signature) return false;

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(hash, 'utf8');
  const received = Buffer.from(String(signature), 'utf8');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  toMinorUnit,
};
