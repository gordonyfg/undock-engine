import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

console.log(`Packaging Undock Engine v${pkgJson.version}...`);

// Ensure build is fresh
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const zipName = `undock-engine-v${pkgJson.version}.zip`;
const zipPath = path.join(rootDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Package contents of dist/ directly into root of zip
execSync(`cd "${distDir}" && zip -r -FS "${zipPath}" ./*`, { stdio: 'inherit' });

console.log(`\n✅ Chrome Web Store package created: ${zipName}`);
console.log(`Size: ${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB`);
console.log(`Ready for upload to Chrome Developer Dashboard!`);
