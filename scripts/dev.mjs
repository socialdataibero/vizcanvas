import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readPort() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, 'utf8').match(/^PORT=(\d+)/m);
    if (match) return match[1];
  }
  throw new Error('No se encontró PORT en .env.local ni .env — cópialo de .env.example.');
}

const port = readPort();
const child = spawn(`npx next dev --turbopack -p ${port}`, {
  stdio: 'inherit',
  shell: true,
  cwd: root,
});
child.on('exit', (code) => process.exit(code ?? 0));
