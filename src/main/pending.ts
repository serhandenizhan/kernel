// Süren işler (IPC istekleri, dosya yazımları): uygulama kapanırken bunlar bitene kadar kısa süre beklenir,
// böylece "ayarı değiştir ve hemen çık" durumunda yazım yarıda kalmaz (Windows'ta disk daha yavaş)
const inFlight = new Set<Promise<unknown>>()

export function track<T>(p: Promise<T>): Promise<T> {
  inFlight.add(p)
  const done = () => inFlight.delete(p)
  p.then(done, done)
  return p
}

export const pendingCount = (): number => inFlight.size

/** Takip edilen (ve beklerken başlayan) işler bitene ya da süre dolana kadar bekler */
export async function waitPending(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (inFlight.size > 0) {
    const left = deadline - Date.now()
    if (left <= 0) return
    await Promise.race([Promise.allSettled([...inFlight]), new Promise((r) => setTimeout(r, left))])
  }
}
