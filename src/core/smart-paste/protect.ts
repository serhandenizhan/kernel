// Kod bölgelerini yer tutucularla gizler; sonraki adımlar (formül avı, kaynak temizliği) onlara dokunmaz
const PH = (n: number) => `\u0000K${n}\u0000`
const PH_RE = /\u0000K(\d+)\u0000/g

export function protectCode(text: string): { text: string; restore(s: string): string } {
  const saved: string[] = []
  const hide = (s: string) => {
    saved.push(s)
    return PH(saved.length - 1)
  }

  // 1) çitli bloklar (satır bazlı; girintili çitler dahil)
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = /^\s*(`{3,}|~{3,})/.exec(lines[i]!)
    if (!open) {
      out.push(lines[i]!)
      continue
    }
    const fence = open[1]!
    const closeRe = new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`)
    let j = i + 1
    while (j < lines.length && !closeRe.test(lines[j]!)) j++
    const end = Math.min(j, lines.length - 1)
    out.push(hide(lines.slice(i, end + 1).join('\n')))
    i = end
  }

  // 2) satır içi kod
  const result = out.join('\n').replace(/(`{1,2})(?!`)([^\n]*?[^`\n])\1(?!`)/g, (m) => hide(m))

  const restore = (s: string): string => {
    let prev: string
    let cur = s
    // iç içe yer tutucular için tekrar et
    do {
      prev = cur
      cur = cur.replace(PH_RE, (_, n: string) => saved[Number(n)] ?? '')
    } while (cur !== prev)
    return cur
  }
  return { text: result, restore }
}
