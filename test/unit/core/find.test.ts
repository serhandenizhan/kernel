import { describe, expect, it } from 'vitest'
import { findInText } from '@core/find'

describe('findInText', () => {
  it('tüm eşleşmelerin başlangıç ve bitişini verir', () => {
    expect(findInText('hız ve hız', 'hız')).toEqual([[0, 3], [7, 10]])
  })
  it('büyük/küçük harf ve Türkçe harflere duyarsız; konumlar özgün metne göre', () => {
    expect(findInText('İvme ve ivme', 'ivme')).toEqual([[0, 4], [8, 12]])
    expect(findInText('Şekil', 'sek')).toEqual([[0, 3]])
    expect(findInText('Işık', 'isik')).toEqual([[0, 4]])
  })
  it('örtüşen eşleşmeler sayılmaz; boş ya da sadece boşluk arama sonuç vermez', () => {
    expect(findInText('aaaa', 'aa')).toEqual([[0, 2], [2, 4]])
    expect(findInText('metin', '')).toEqual([])
    expect(findInText('metin', '   ')).toEqual([])
  })
})
