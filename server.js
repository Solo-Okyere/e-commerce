const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname);

console.log('Starting backend server...');
const backend = spawn('node', ['index.js'], {
  cwd: path.join(rootDir, 'backend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '5000',
    DB_PATH: '/data/ecommerce.db',
  },
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err.message);
  process.exit(1);
});

backend.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`Backend exited with code ${code}`);
  }
});

setTimeout(() => {
  console.log('Starting frontend server...');
  const frontend = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '8080', '--hostname', '0.0.0.0'], {
    cwd: path.join(rootDir, 'frontend'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '8080',
      NEXT_PUBLIC_API_URL: 'http://localhost:5000',
    },
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err.message);
    process.exit(1);
  });

  frontend.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Frontend exited with code ${code}`);
    }
  });
}, 2000);

process.on('SIGTERM', () => {
  backend.kill();
});

process.on('SIGINT', () => {
  backend.kill();
});