import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve('src/shared'),
  '@core': resolve('src/core')
}

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    // sandbox: true preload'u CommonJS olarak ister
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } }
  },
  renderer: { plugins: [react()], resolve: { alias: { ...alias, '@renderer': resolve('src/renderer') } } }
})
