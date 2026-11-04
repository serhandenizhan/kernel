import { contextBridge } from 'electron'

// window.kernel API'si sonraki görevlerde doldurulacak
contextBridge.exposeInMainWorld('kernel', {})
