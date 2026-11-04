import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface PasteCase {
  name: string
  input?: string
  html?: string
  text?: string
  expected: string
}

// cases.txt dosyasını "=== ad ===" bölümlerine ayırır (Vitest ve Playwright ortak kullanır)
export function loadCases(): PasteCase[] {
  const raw = readFileSync(fileURLToPath(new URL('./cases.txt', import.meta.url)), 'utf8')
  const parts = raw.split(/^=== (.+) ===$/m).slice(1)
  const out: PasteCase[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i + 1] ?? ''
    const sections: Record<string, string> = {}
    const pieces = body.split(/^--- (input|html|text|expected) ---$/m).slice(1)
    for (let k = 0; k < pieces.length; k += 2) sections[pieces[k]!] = pieces[k + 1]!.replace(/^\n/, '').replace(/\n+$/, '')
    out.push({ name: parts[i]!, input: sections['input'], html: sections['html'], text: sections['text'], expected: sections['expected'] ?? '' })
  }
  return out
}
