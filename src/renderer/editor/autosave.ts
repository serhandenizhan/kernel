export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export interface Autosave {
  schedule(): void
  /** Bekleyen kaydı hemen yapar; sonunda her şey kaydedildiyse true */
  flush(): Promise<boolean>
  /** Kaydı askıya alır (örn. çakışma penceresi açıkken dış değişikliğin üzerine yazılmasın) */
  pause(): void
  resume(): void
  /** Bekleyen değişikliği kaydetmeden atar (içerik diskten yeniden yüklendiğinde) */
  reset(): void
  readonly state: SaveState
  dispose(): void
}

const RETRY_MS = 5000

// Son değişiklikten delayMs sonra kaydeder; hata olursa 5 sn'de bir tekrar dener
export function createAutosave(save: () => Promise<void>, delayMs = 500, onState?: (s: SaveState) => void): Autosave {
  let state: SaveState = 'saved'
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let pendingAgain = false
  let paused = false
  let disposed = false

  const setState = (s: SaveState) => {
    if (s === state) return
    state = s
    onState?.(s)
  }

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const arm = (ms: number) => {
    clear()
    if (!paused && !disposed) timer = setTimeout(() => void run(), ms)
  }

  const run = async (): Promise<void> => {
    clear()
    if (paused) return
    if (running) {
      // kayıt sürerken yeni değişiklik geldi: bittikten sonra tekrar kaydet
      pendingAgain = true
      return running
    }
    setState('saving')
    running = (async () => {
      try {
        await save()
        setState(pendingAgain ? 'dirty' : 'saved')
      } catch {
        setState('error')
        arm(RETRY_MS)
      } finally {
        running = null
      }
    })()
    await running
    if (pendingAgain) {
      pendingAgain = false
      await run()
    }
  }

  return {
    schedule() {
      if (running) pendingAgain = true
      else if (state !== 'error') setState('dirty')
      arm(delayMs)
    },
    async flush() {
      if (paused) return state === 'saved'
      if (running) await running
      if (state !== 'saved' || timer) await run()
      return state === 'saved'
    },
    pause() {
      paused = true
      clear()
    },
    resume() {
      paused = false
      if (state !== 'saved') arm(delayMs)
    },
    reset() {
      clear()
      pendingAgain = false
      setState('saved')
    },
    get state() {
      return state
    },
    dispose() {
      disposed = true
      clear()
    }
  }
}
