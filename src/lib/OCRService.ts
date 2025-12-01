// This file is deprecated as we removed Auto OCR.
// Keeping it empty for now to avoid breaking imports if any remain, 
// though we should have removed all usages.

export async function detectTextRegions(source: HTMLCanvasElement | HTMLImageElement, lang: string = 'jpn'): Promise<any[]> {
    return [];
}