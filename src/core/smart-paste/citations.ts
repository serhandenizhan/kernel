// NotebookLM tarzı kaynak numaralarını ([1], [2, 3], [4-6]) siler.
// Yalnızca bir harfe ya da noktalamaya bitişik olanlar silinir; "dizi [0, 1]" gibi boşluklu ifadeler korunur.
const CITATION = /(?<=[\p{L}\p{P}])\[\d+(?:\s*[,–-]\s*\d+)*\]/gu

export function stripCitations(text: string): string {
  return text.replace(CITATION, '')
}
