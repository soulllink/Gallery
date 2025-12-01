import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base: process.env.VITE_BASE || '/',
  optimizeDeps: {
    exclude: ['@tensorflow/tfjs-tflite']
  },
  // Ensure WASM files are treated as assets
  assetsInclude: ['**/*.wasm'],
  // Worker configuration for threaded TFLite variants
  worker: {
    format: 'es'
  }
})
