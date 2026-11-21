import { app } from 'electron'

// Paketli uygulamada geliştirme ve test ortam değişkenleri devre dışıdır
export function isPackagedApp(): boolean {
  return Boolean(app?.isPackaged)
}

export function devEnv(name: string): string | undefined {
  return isPackagedApp() ? undefined : process.env[name]
}
