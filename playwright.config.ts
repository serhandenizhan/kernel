import { defineConfig } from '@playwright/test'

export default defineConfig({ testDir: 'test', testMatch: ['e2e/**/*.spec.ts', 'pdf/**/*.spec.ts'], timeout: 60_000, workers: 1, reporter: 'line' })
