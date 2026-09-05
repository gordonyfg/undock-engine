import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const isWatch = process.argv.includes('--watch');
const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

async function copyStaticFiles() {
  // Copy manifest.json
  fs.copyFileSync(path.resolve('manifest.json'), path.join(distDir, 'manifest.json'));

  // Copy icons
  const distIcons = path.join(distDir, 'icons');
  if (!fs.existsSync(distIcons)) {
    fs.mkdirSync(distIcons, { recursive: true });
  }

  const srcIcons = path.resolve('icons');
  if (fs.existsSync(srcIcons)) {
    const iconFiles = fs.readdirSync(srcIcons);
    for (const file of iconFiles) {
      fs.copyFileSync(path.join(srcIcons, file), path.join(distIcons, file));
    }
  }
}

async function build() {
  try {
    await copyStaticFiles();

    // 1. Build Service Worker
    await esbuild.build({
      entryPoints: ['src/background/service-worker.ts'],
      outfile: 'dist/service-worker.js',
      bundle: true,
      format: 'esm',
      target: 'es2022',
      sourcemap: !isWatch ? false : 'inline',
      minify: !isWatch,
    });

    // 2. Build Content Script
    await esbuild.build({
      entryPoints: ['src/content.ts'],
      outfile: 'dist/content.js',
      bundle: true,
      format: 'iife',
      target: 'es2022',
      sourcemap: !isWatch ? false : 'inline',
      minify: !isWatch,
    });

    console.log('Build completed successfully. Unpacked extension ready in ./dist');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
