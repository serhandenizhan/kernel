/** Menüde ok tuşuyla bir sonraki / önceki öğe: sondan başa, baştan sona sarar; -1 hiçbiri seçili değil */
export function moveIndex(length: number, current: number, dir: 1 | -1): number {
  if (length <= 0) return -1
  if (current < 0) return dir === 1 ? 0 : length - 1
  return (current + dir + length) % length
}
