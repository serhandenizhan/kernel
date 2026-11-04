import { describe, it, expect } from 'vitest'
import { extractMath } from '@core/smart-paste/math'

describe('extractMath', () => {
  it('\\( \\) satır içi formül olur', () => {
    expect(extractMath('Formül: \\(\\vec{v} \\approx 1\\). Son.')).toBe('Formül: $\\vec{v} \\approx 1$. Son.')
  })
  it('liste içindeki \\[ \\] maddenin girintisiyle blok olur', () => {
    expect(extractMath('- madde:\n  \\[h_t = f(x)\\]\n- diğer')).toBe('- madde:\n\n  $$\n  h_t = f(x)\n  $$\n\n- diğer')
  })
  it('para birimi $ kaçırılır, gerçek formül korunur', () => {
    expect(extractMath('5$ ile 10$ arası, $x^2$ ise formül')).toBe('5\\$ ile 10\\$ arası, $x^2$ ise formül')
    expect(extractMath('fiyat $5 ile $10 arası')).toBe('fiyat \\$5 ile \\$10 arası')
  })
  it('zaten kaçırılmış \\$ olduğu gibi kalır', () => {
    expect(extractMath('maliyet \\$5')).toBe('maliyet \\$5')
  })
  it('align ortamı blok formül olur', () => {
    expect(extractMath('\\begin{align}a&=b\\\\c&=d\\end{align}')).toBe('$$\n\\begin{align}a&=b\\\\c&=d\\end{align}\n$$')
  })
  it('formül içi komutlara dokunmaz', () => {
    expect(extractMath('\\(\\text{hidden\\_size} \\times 2\\)')).toBe('$\\text{hidden\\_size} \\times 2$')
  })
  it('kendi satırındaki çok satırlı $$ ve \\[ blokları', () => {
    expect(extractMath('önce\n$$\na\n+b\n$$\nsonra')).toBe('önce\n\n$$\na\n+b\n$$\n\nsonra')
    expect(extractMath('\\[\n  x = 1\n\\]')).toBe('$$\nx = 1\n$$')
  })
  it('satır ortasındaki $$..$$ satır içi formül olur', () => {
    expect(extractMath('metin $$x$$ devam')).toBe('metin $x$ devam')
  })
  it('kapanmayan ayraç metin olarak kalır', () => {
    expect(extractMath('\\(açık kaldı')).toBe('\\(açık kaldı')
  })
})
