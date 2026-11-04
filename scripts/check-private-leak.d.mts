export function findOverlaps(privateTexts: string[], files: { path: string; text: string }[]): { path: string; line: number; kind: 'line' | 'phrase' }[]
