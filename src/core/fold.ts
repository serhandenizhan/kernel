/**
 * APFS'teki büyük/küçük harf duyarsızlığına göre karşılaştırma anahtarı.
 * APFS "I"yı "i" sayar; Türkçe toLocaleLowerCase ise "I"yı "ı" yapar ve çakışmayı kaçırır.
 * I/İ/ı/i hepsi aynı kabul edilir.
 */
export const foldKey = (s: string): string => s.normalize('NFC').replace(/[Iİı]/g, 'i').toLowerCase().normalize('NFC')
