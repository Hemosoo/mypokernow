import { defineConfig } from 'vite';
export default defineConfig({base: './', build: {target: 'chrome120', sourcemap: true}, server: {host: '127.0.0.1'}});
