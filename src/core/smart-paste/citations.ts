// NotebookLM tarzı kaynak numaralarını ([1], [2, 3], [4-6]) siler.
// Yalnızca harfe ya da sonlandırıcı noktalamaya bitişik 1 tabanlı olanlar silinir;
// "arr[0]", "matris[1][2]", "[örnek][1]", satır içi kod ve boşluklu ifadeler korunur.
const CITATION = /(?<=[\p{L}.,;:!?)'"”’»*])\[[1-9]\d*(?:\s*[,–-]\s*[1-9]\d*)*\](?!\[)/gu

export function stripCitations(text: string): string {
  return text
    .split(/(`+[^`]*`+)/)
    .map((part) => (part.startsWith('`') ? part : part.replace(CITATION, '')))
    .join('')
}
