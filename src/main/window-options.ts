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

/**
 * Otomatik testlerde pencere gösterilmez ve Dock'ta görünmez: testler çalışırken kullanıcı bilgisayarını rahatça kullanabilsin (odak çalınmaz).
 * KERNEL_TEST_SHOW=1 ile (hata ayıklarken) ya da ekran görüntüsü alırken (KERNEL_SCREENSHOTS=1) pencere görünür.
 */
export function isHeadlessTest(env: Record<string, string | undefined>): boolean {
  return !!env['KERNEL_TEST'] && !env['KERNEL_TEST_SHOW'] && !env['KERNEL_SCREENSHOTS']
}
