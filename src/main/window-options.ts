import type { BrowserWindowConstructorOptions } from 'electron'

// Pencere görünümü platforma göre: macOS'ta trafik ışıkları kenar çubuğunun içinde ve vibrancy;
// Windows / Linux'ta normal pencere çerçevesi ve opak zemin (vibrancy yok, saydam zemin siyah görünür)
export function windowOptions(platform: string, dark: boolean): BrowserWindowConstructorOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
      vibrancy: 'sidebar',
      visualEffectState: 'followWindow',
      backgroundColor: '#00000000'
    }
  }
  // menü çubuğu Alt ile görünür; zemin arayüzün opak zeminiyle aynı renk (açılışta beyaz/siyah parlama olmasın)
  return { autoHideMenuBar: true, backgroundColor: dark ? '#141a20' : '#dce5ec' }
}
