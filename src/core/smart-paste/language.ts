import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import matlab from 'highlight.js/lib/languages/matlab'
import r from 'highlight.js/lib/languages/r'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import csharp from 'highlight.js/lib/languages/csharp'
import php from 'highlight.js/lib/languages/php'

// Desteklenen diller (Kernel adı → highlight.js modülü)
const LANGS = { python, c, cpp, java, javascript, typescript, sql, bash, html: xml, css, json, yaml, markdown, matlab, r, go, rust, kotlin, swift, csharp, php }
for (const [name, mod] of Object.entries(LANGS)) hljs.registerLanguage(name, mod)

export const SUPPORTED_LANGUAGES = Object.keys(LANGS)

const ALIASES: Record<string, string | null> = {
  py: 'python', python3: 'python', py3: 'python',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', node: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', h: 'c',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
  md: 'markdown', yml: 'yaml', htm: 'html', xml: 'html',
  'c#': 'csharp', cs: 'csharp', kt: 'kotlin', rs: 'rust', golang: 'go', m: 'matlab', octave: 'matlab', postgres: 'sql', mysql: 'sql', sqlite: 'sql',
  text: null, txt: null, plain: null, plaintext: null, none: null, output: null
}

// Çit etiketini Kernel dil adına çevirir; düz metin etiketleri null olur
export function normalizeLanguage(tag: string | null): string | null {
  if (!tag) return null
  const t = tag.trim().toLowerCase()
  if (!t) return null
  if (t in ALIASES) return ALIASES[t] ?? null
  return t
}

const CPP_ONLY = /std::|\bcout\b|\bcin\b|#include\s*<(?:iostream|vector|string|map|algorithm)>|\btemplate\s*<|\bnamespace\b|\bclass\s+\w+\s*[:{]|\bnew\s+\w+|::/

// Etiketsiz kodun dilini tahmin eder; emin değilse null
const MERMAID_START = /^(?:(?:graph|flowchart)\s+(?:TD|TB|LR|RL|BT)\b|(?:sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|journey)\b)/

export function detectLanguage(code: string): string | null {
  if (!code.trim()) return null
  // Mermaid diyagramları ilk satırlarından tanınır (highlight.js bilmez)
  const first = code.split('\n').find((l) => l.trim())?.trim() ?? ''
  if (MERMAID_START.test(first)) return 'mermaid'
  const res = hljs.highlightAuto(code, SUPPORTED_LANGUAGES)
  if (!res.language || res.relevance < 4) return null
  // C ve C++ çoğu zaman karışır: C++'a özgü bir iz yoksa C kabul et
  if (res.language === 'cpp' && !CPP_ONLY.test(code)) return 'c'
  return res.language
}
