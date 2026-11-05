import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@core': resolve('src/core'), '@renderer': resolve('src/renderer') } },
  test: { include: ['test/unit/**/*.test.ts', 'test/unit/**/*.test.tsx'], environment: 'node' }
})
