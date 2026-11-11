import { defineConfig } from 'vite';
export default defineConfig({base: './', build: {rollupOptions: {input: ['index.html', 'preview.html']}, target: 'chrome120', sourcemap: true}, server: {host: '127.0.0.1'}});
