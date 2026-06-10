const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) return;
  loaded = true;

  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const candidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  const envPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
}

function getPaystackSecretKey() {
  return (
    process.env.PAYSTACK_SECRET_KEY ||
    (process.env.NODE_ENV === 'production'
      ? process.env.PAYSTACK_LIVE_SECRET_KEY
      : process.env.PAYSTACK_TEST_SECRET_KEY) ||
    process.env.PAYSTACK_LIVE_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY ||
    ''
  );
}

module.exports = {
  loadEnv,
  getPaystackSecretKey,
};
