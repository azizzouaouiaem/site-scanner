import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const chromiumPackage = dirname(dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium'))));
const binDirectory = join(chromiumPackage, 'bin');
const publicDirectory = join(projectRoot, 'public');
const archivePath = join(publicDirectory, 'chromium-pack.tar');

if (existsSync(binDirectory)) {
  mkdirSync(publicDirectory, { recursive: true });
  const tarPath = process.platform === 'darwin' ? '/usr/bin/tar' : '/bin/tar';
  execFileSync(tarPath, ['-cf', archivePath, '-C', binDirectory, '.'], { stdio: 'inherit' });
}