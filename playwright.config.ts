import { defineConfig } from '@playwright/test'

// CI makineleri (özellikle GitHub'ın macOS sanal makinesi) yavaş: zamanlamaya bağlı kararsızlık için yalnızca CI'da 2 yeniden deneme.
// Yeniden denemede geçen test raporda "flaky" olarak görünür; yerelde yeniden deneme yok.
export default defineConfig({ testDir: 'test', testMatch: ['e2e/**/*.spec.ts', 'pdf/**/*.spec.ts'], timeout: 60_000, workers: 1, reporter: 'line', retries: process.env['CI'] ? 2 : 0 })
