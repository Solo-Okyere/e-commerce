const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname);
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const frontendPort = process.env.PORT || '8080';
const backendPort = process.env.BACKEND_PORT || (frontendPort === '5000' ? '5001' : '5000');
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
    PORT: backendPort,
    HOST: '127.0.0.1',
    BACKEND_HOST: '127.0.0.1',
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

function waitForBackendReady() {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.BACKEND_READY_TIMEOUT_MS || 90000);
  const url = `http://127.0.0.1:${backendPort}/health`;

  return new Promise((resolve, reject) => {
    function check() {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });

      request.on('error', retry);
      request.setTimeout(2000, () => {
        request.destroy();
        retry();
      });
    }

    function retry() {
      if (shuttingDown) return;
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Backend did not become ready within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 1000);
    }

    check();
  });
}

async function startFrontend() {
  try {
    await waitForBackendReady();
  } catch (error) {
    console.error('Failed waiting for backend readiness:', error.message);
    backend.kill();
    process.exit(1);
  }

  console.log('Starting frontend server...');
  const nextBin = require.resolve('next/dist/bin/next', { paths: [frontendDir, rootDir] });
  frontend = spawn(process.execPath, [nextBin, 'start', '-p', frontendPort, '--hostname', '0.0.0.0'], {
    cwd: frontendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: frontendPort,
      BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}`,
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
}

startFrontend();

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
