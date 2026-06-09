const { spawn, spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname);
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
let shuttingDown = false;
let frontend = null;

function supportsNodeArg(arg) {
  const result = spawnSync(process.execPath, [arg, '-e', ''], { stdio: 'ignore' });
  return result.status === 0;
}

const backendArgs = supportsNodeArg('--use-system-ca')
  ? ['--use-system-ca', 'index.js']
  : ['index.js'];

if (backendArgs[0] !== '--use-system-ca') {
  console.warn('Warning: current Node version does not support --use-system-ca. Starting backend without it.');
}

console.log('Starting backend server...');
const backend = spawn(process.execPath, backendArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '5000',
  },
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err.message);
  process.exit(1);
});

backend.on('exit', (code) => {
  if (shuttingDown) return;

  if (code !== null && code !== 0) {
    console.error(`Backend exited with code ${code}`);
  }
  if (frontend) frontend.kill();
  process.exit(code || 1);
});

setTimeout(() => {
  console.log('Starting frontend server...');
  const nextBin = require.resolve('next/dist/bin/next', { paths: [frontendDir, rootDir] });
  frontend = spawn(process.execPath, [nextBin, 'start', '-p', '8080', '--hostname', '0.0.0.0'], {
    cwd: frontendDir,
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
    if (shuttingDown) return;

    if (code !== null && code !== 0) {
      console.error(`Frontend exited with code ${code}`);
    }
    backend.kill();
    process.exit(code || 1);
  });
}, 2000);

function stopChildren() {
  shuttingDown = true;
  if (frontend) frontend.kill();
  backend.kill();
}

process.on('SIGTERM', () => {
  stopChildren();
});

process.on('SIGINT', () => {
  stopChildren();
});
