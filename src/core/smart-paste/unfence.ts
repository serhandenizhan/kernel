// Kod bloğuna yapıştırılan metin tek bir ```dil … ``` bloğuysa çitler atılır (çit satırları kodun parçası değildir)
export function unfence(text: string): { code: string; lang: string | null } | null {
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n')
  if (lines.length < 2) return null
  const open = /^(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/.exec(lines[0]!)
  if (!open) return null
  const fence = open[1]!
  const last = lines[lines.length - 1]!.trim()
  if (!last.startsWith(fence[0]!.repeat(3)) || last.replace(/[`~]/g, '') !== '' || last.length < fence.length) return null
  const body = lines.slice(1, -1)
  // içeride aynı çit yeniden açılıyorsa birden çok bloktur
  if (body.some((l) => l.trim().startsWith(fence))) return null
  return { code: body.join('\n'), lang: open[2] ? open[2] : null }
}
