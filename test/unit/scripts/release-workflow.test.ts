import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

interface Step {
  uses?: string
  with?: Record<string, unknown>
  run?: string
}

interface Workflow {
  jobs: Record<
    string,
    {
      needs?: string | string[]
      steps: Step[]
    }
  >
}

describe('release workflow (.github/workflows/release.yml)', () => {
  const wf = parse(readFileSync('.github/workflows/release.yml', 'utf8')) as Workflow

  it('create ve build işleri her zaman hedef etiketi (env.TAG) çeker', () => {
    for (const jobName of ['create', 'build']) {
      const checkout = wf.jobs[jobName]!.steps.find((s) => s.uses?.startsWith('actions/checkout@'))
      expect(checkout?.with?.['ref'], `${jobName} checkout ref`).toBe('${{ env.TAG }}')
    }
  })

  it('etiket biçimi ile package.json sürümünün eşleştiğini doğrular', () => {
    const script = wf.jobs['create']!.steps.map((s) => s.run ?? '').join('\n')
    expect(script).toContain('package.json')
    expect(script).toMatch(/v\[0-9\]|v\\d|replace\(\/\^v\//)
  })

  it('sürümü önce taslak (--draft) oluşturur ve sürüm notu dosyasını güvenli biçimde okur', () => {
    const script = wf.jobs['create']!.steps.map((s) => s.run ?? '').join('\n')
    expect(script).toContain('--draft')
    expect(script).toContain('docs/release-notes/$TAG.md')
    expect(script).not.toMatch(/\$\(\s*\[/)
  })

  it('publish işi tüm derlemeler (build) bittikten sonra taslağı yayımlar', () => {
    const pub = wf.jobs['publish']
    expect(pub).toBeDefined()
    expect(pub!.needs).toBe('build')
    const script = pub!.steps.map((s) => s.run ?? '').join('\n')
    expect(script).toMatch(/gh release edit "\$TAG" --draft=false/)
  })
})
