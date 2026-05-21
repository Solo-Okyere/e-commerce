const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const frontendOutDir = path.join(rootDir, 'frontend', 'out');
const publishDir = path.join(rootDir, 'build');

const env = {
  ...process.env,
  STATIC_EXPORT: 'true',
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    'https://fosogo-na.onrender.com',
};

const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm run build --workspace=frontend']
    : ['run', 'build', '--workspace=frontend'];

const result = spawnSync(command, args, {
  cwd: rootDir,
  env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  if (result.error) {
    console.error(result.error.message);
  }
  process.exit(result.status || 1);
}

fs.rmSync(publishDir, { recursive: true, force: true });
fs.cpSync(frontendOutDir, publishDir, { recursive: true });

console.log(`Copied static frontend export to ${path.relative(rootDir, publishDir)}`);
