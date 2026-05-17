const http = require('http');
const data = JSON.stringify({ email: 'admin@fosogo.com', password: 'admin123' });
const opts = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', async () => {
    console.log('LOGIN', res.statusCode, body);
    if (res.statusCode !== 200) return;

    const token = JSON.parse(body).token;
    const paths = ['/api/products', '/api/categories', '/api/users', '/api/payments/orders/all'];
    for (const path of paths) {
      await new Promise((resolve) => {
        const opts2 = {
          hostname: 'localhost',
          port: 5000,
          path,
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        };
        const req2 = http.request(opts2, (res2) => {
          let body2 = '';
          res2.on('data', (chunk) => (body2 += chunk));
          res2.on('end', () => {
            console.log(path, res2.statusCode, body2.slice(0, 200));
            resolve();
          });
        });
        req2.on('error', (err) => {
          console.error(path, 'ERROR', err.message);
          resolve();
        });
        req2.end();
      });
    }
  });
});
req.on('error', (err) => console.error('LOGIN ERR', err.message));
req.write(data);
req.end();
