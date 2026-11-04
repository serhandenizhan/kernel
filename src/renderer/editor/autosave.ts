export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export interface Autosave {
  schedule(): void
  flush(): Promise<void>
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

  const setState = (s: SaveState) => {
    if (s === state) return
    state = s
    onState?.(s)
  }

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const run = async (): Promise<void> => {
    clear()
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
        timer = setTimeout(() => void run(), RETRY_MS)
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
      else setState('dirty')
      clear()
      timer = setTimeout(() => void run(), delayMs)
    },
    async flush() {
      if (state === 'saved' && !running) return
      if (running) await running
      if (state !== 'saved' || timer) await run()
    },
    get state() {
      return state
    },
    dispose() {
      clear()
    }
  }
}
