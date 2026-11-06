import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { macSwapScript } from '@core/update'

// Betik gerçek klasörlerle çalıştırılır; "open" ve "xattr" sahte komutlarla değiştirilir
describe.skipIf(process.platform === 'win32')('macOS paket değiştirme betiği', () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'kernel-swap-'))
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    for (const cmd of ['open', 'xattr']) {
      writeFileSync(join(bin, cmd), `#!/bin/sh\necho "${cmd} $*" >> "${join(dir, 'calls.log')}"\n`)
      chmodSync(join(bin, cmd), 0o755)
    }
    const installed = join(dir, 'Applications', 'Kernel.app')
    const fresh = join(dir, 'new', 'Kernel.app')
    mkdirSync(installed, { recursive: true })
    mkdirSync(fresh, { recursive: true })
    writeFileSync(join(installed, 'v'), 'old')
    writeFileSync(join(fresh, 'v'), 'new')
    const script = join(dir, 'swap.sh')
    writeFileSync(script, macSwapScript())
    return { dir, bin, installed, fresh, script }
  }

  it('uygulama kapanmışsa yeni paketi yerine koyar, yedeği siler ve yeniden açar', () => {
    const { dir, bin, installed, fresh, script } = setup()
    execFileSync('/bin/sh', [script, '999999', installed, fresh], { env: { PATH: `${bin}:/usr/bin:/bin` } })
    expect(readFileSync(join(installed, 'v'), 'utf8')).toBe('new')
    expect(existsSync(`${installed}.old`)).toBe(false)
    expect(readFileSync(join(dir, 'calls.log'), 'utf8')).toContain(`open ${installed}`)
  })

  it('yeni paket yoksa eskisini geri koyar ve onu açar', () => {
    const { bin, installed, script, dir } = setup()
    execFileSync('/bin/sh', [script, '999999', installed, join(dir, 'yok', 'Kernel.app')], { env: { PATH: `${bin}:/usr/bin:/bin` } })
    expect(readFileSync(join(installed, 'v'), 'utf8')).toBe('old')
    expect(existsSync(`${installed}.old`)).toBe(false)
  })
})
