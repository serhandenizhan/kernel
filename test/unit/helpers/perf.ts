// Hız testleri için süre sınırı: yerelde sınır aynen geçerli (gerçek yavaşlama yakalanır);
// CI'nın paylaşılan sanal makineleri (özellikle macOS) düzensiz yavaş olduğu için orada 4 kat pay verilir.
export function perfBudget(ms: number, env: Record<string, string | undefined> = process.env): number {
  return env['CI'] ? ms * 4 : ms
}
