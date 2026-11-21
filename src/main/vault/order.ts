import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './atomic'
import { readJsonFile, type JsonFileOpts } from './json-file'

// Kenar çubuğundaki elle sıralama: { [ebeveynId | "root"]: id[] }
export type Order = Record<string, string[]>

export async function loadOrder(root: string, opts?: JsonFileOpts): Promise<Order> {
  const { value: data } = await readJsonFile<unknown>(join(root, '.kernel', 'order.json'), () => ({}), opts)
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Order) : {}
}

export async function saveOrder(root: string, order: Order): Promise<void> {
  await mkdir(join(root, '.kernel'), { recursive: true })
  await writeAtomic(join(root, '.kernel', 'order.json'), JSON.stringify(order, null, 2))
}
