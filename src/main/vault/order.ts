import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './atomic'

// Kenar çubuğundaki elle sıralama: { [ebeveynId | "root"]: id[] }
export type Order = Record<string, string[]>

export async function loadOrder(root: string): Promise<Order> {
  try {
    const data = JSON.parse(await readFile(join(root, '.kernel', 'order.json'), 'utf8'))
    return data && typeof data === 'object' ? (data as Order) : {}
  } catch {
    return {}
  }
}

export async function saveOrder(root: string, order: Order): Promise<void> {
  await mkdir(join(root, '.kernel'), { recursive: true })
  await writeAtomic(join(root, '.kernel', 'order.json'), JSON.stringify(order, null, 2))
}
