import { build as viteBuild } from 'vite';
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
await import('./generate-icons.mjs');
await viteBuild();
await build({entryPoints: ['src/content/index.ts'], bundle: true, format: 'iife', target: 'chrome120', outfile: 'dist/content.js', sourcemap: true, minify: true});
// The 3D puppy (Three.js) ships as its own module; content.js imports it only on a Puppy table.
await build({entryPoints: ['src/puppy/index.ts'], bundle: true, format: 'esm', target: 'chrome120', outfile: 'dist/puppy.js', sourcemap: true, minify: true, legalComments: 'linked'});
await build({entryPoints: ['src/background/index.ts'], bundle: true, format: 'esm', target: 'chrome120', outfile: 'dist/background.js', sourcemap: true, minify: true});
await mkdir('dist', {recursive:true});
await copyFile('manifest.json','dist/manifest.json');

await copyFile('THIRD_PARTY_NOTICES.md','dist/THIRD_PARTY_NOTICES.md');
