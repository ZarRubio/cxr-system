import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
