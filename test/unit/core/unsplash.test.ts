import { describe, expect, it } from 'vitest'
import { creditLine, isUnsplashImageUrl, isUnsplashLink, parseSearch, photoFileUrl, searchUrl } from '@core/unsplash'

const reply = {
  total: 2,
  total_pages: 1,
  results: [
    {
      id: 'abc',
      alt_description: 'mavi dağ',
      urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x', thumb: 'https://images.unsplash.com/photo-1?w=200' },
      user: { name: 'Ada Yılmaz', links: { html: 'https://unsplash.com/@ada' } },
      links: { download_location: 'https://api.unsplash.com/photos/abc/download?ixid=x' }
    },
    { id: 'bozuk', urls: {}, user: {} }
  ]
}

describe('unsplash', () => {
  it('arama adresi sorguyu kodlar, yatay görsel ister', () => {
    const u = new URL(searchUrl('dağ & deniz', 2))
    expect(u.origin + u.pathname).toBe('https://api.unsplash.com/search/photos')
    expect(u.searchParams.get('query')).toBe('dağ & deniz')
    expect(u.searchParams.get('page')).toBe('2')
    expect(u.searchParams.get('orientation')).toBe('landscape')
  })
  it('yanıttan yalnızca geçerli fotoğrafları alır', () => {
    const r = parseSearch(reply)
    expect(r.totalPages).toBe(1)
    expect(r.photos).toEqual([
      { id: 'abc', alt: 'mavi dağ', raw: 'https://images.unsplash.com/photo-1?ixid=x', thumb: 'https://images.unsplash.com/photo-1?w=200', author: 'Ada Yılmaz', authorUrl: 'https://unsplash.com/@ada', downloadLocation: 'https://api.unsplash.com/photos/abc/download?ixid=x' }
    ])
  })
  it('bozuk yanıt boş liste verir', () => {
    expect(parseSearch(null).photos).toEqual([])
    expect(parseSearch({ results: 5 }).photos).toEqual([])
  })
  it('yalnızca images.unsplash.com görselleri ve unsplash.com bağlantıları kabul edilir', () => {
    expect(isUnsplashImageUrl('https://images.unsplash.com/photo-1')).toBe(true)
    expect(isUnsplashImageUrl('https://images.unsplash.com.evil.example/x')).toBe(false)
    expect(isUnsplashImageUrl('http://images.unsplash.com/x')).toBe(false)
    expect(isUnsplashLink('https://unsplash.com/@ada')).toBe(true)
    expect(isUnsplashLink('https://unsplash.com.evil.example/')).toBe(false)
    expect(isUnsplashLink('https://user:pw@unsplash.com/')).toBe(false)
  })
  it('kapak dosyası adresi genişlik ve kalite parametreleri ekler', () => {
    const u = new URL(photoFileUrl('https://images.unsplash.com/photo-1?ixid=x'))
    expect(u.searchParams.get('ixid')).toBe('x')
    expect(u.searchParams.get('w')).toBe('2000')
    expect(u.searchParams.get('fm')).toBe('jpg')
  })
  it('kaynak satırı fotoğrafçıyı ve Unsplash adını içerir', () => {
    expect(creditLine('Ada Yılmaz')).toBe('Ada Yılmaz · Unsplash')
  })
})
