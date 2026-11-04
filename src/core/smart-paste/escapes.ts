// NotebookLM gibi kaynakların çift kaçışlı formül ayraçlarını (\\( \\) \\[ \\]) teke indirir
export function normalizeEscapes(text: string): string {
  return text.replace(/\\\\([()[\]])/g, '\\$1')
}
