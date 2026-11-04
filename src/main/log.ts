import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Basit dosya logu: ~/Library/Logs/Kernel/main.log (uzak telemetri yok)
let file: string | null = null

function target(): string {
  if (!file) {
    app.setAppLogsPath()
    const dir = app.getPath('logs')
    mkdirSync(dir, { recursive: true })
    file = join(dir, 'main.log')
  }
  return file
}

function write(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`
  try {
    appendFileSync(target(), line)
  } catch {
    // log yazılamazsa uygulamayı durdurma
  }
}

export const log = {
  info: (...a: unknown[]) => write('info', a),
  warn: (...a: unknown[]) => write('warn', a),
  error: (...a: unknown[]) => write('error', a)
}

export function installCrashLogging(): void {
  process.on('uncaughtException', (e) => log.error('uncaughtException', e))
  process.on('unhandledRejection', (e) => log.error('unhandledRejection', e))
}
