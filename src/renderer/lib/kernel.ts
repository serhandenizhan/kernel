import type { KernelApi } from '@shared/types'

declare global {
  interface Window {
    kernel: KernelApi
  }
}

// Ana sürece giden tek kapı (preload'un sunduğu API)
export const kernel: KernelApi = window.kernel
