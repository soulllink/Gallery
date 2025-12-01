import { recognizeSelection } from '../OllamaOCRService';
import { screenToImageCoords, type TransformParams } from '../CoordinateTransforms';
import { dbService } from '../DatabaseService';

export interface OCRResultItem {
    text: string;
    translation: string;
    x: number;
    y: number;
    w: number;
    h: number;
    visible: boolean;
    loading: boolean;
    isFallback?: boolean;
    dbId?: number; // To allow deletion from DB
}

export async function performOCR(
    selection: { x: number, y: number, w: number, h: number },
    media: { image: HTMLImageElement | null, video: HTMLVideoElement | null, currentFilePath?: string },
    params: TransformParams,
    existingResults: OCRResultItem[]
): Promise<OCRResultItem[]> {
    const source = media.image || media.video;
    if (!source) return existingResults;

    const p1 = screenToImageCoords(selection.x, selection.y, params);
    const p2 = screenToImageCoords(selection.x + selection.w, selection.y + selection.h, params);
    const imgX = Math.min(p1.x, p2.x);
    const imgY = Math.min(p1.y, p2.y);
    const imgW = Math.abs(p2.x - p1.x);
    const imgH = Math.abs(p2.y - p1.y);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgW;
    tempCanvas.height = imgH;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return existingResults;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, imgW, imgH);
    ctx.drawImage(source as any, imgX, imgY, imgW, imgH, 0, 0, imgW, imgH);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);

    const newResults = [...existingResults, {
        text: "Scanning...",
        translation: "Translating...",
        x: imgX,
        y: imgY,
        w: imgW,
        h: imgH,
        visible: true,
        loading: true
    }];

    const resultIndex = newResults.length - 1;

    try {
        const targetLang = params.settings?.targetLanguage || "English";
        const result = await recognizeSelection(dataUrl, targetLang);

        newResults[resultIndex] = {
            ...newResults[resultIndex],
            text: result.originalText,
            translation: result.translation,
            loading: false
        };

        // Save to Database
        if (media.currentFilePath) {
            await dbService.saveTranslation({
                file_path: media.currentFilePath,
                x: imgX,
                y: imgY,
                w: imgW,
                h: imgH,
                text: result.originalText,
                translated_text: result.translation,
                language: targetLang
            });
        }

    } catch (e) {
        newResults[resultIndex].translation = "Error: " + (e as Error).message;
        newResults[resultIndex].loading = false;
    }

    return newResults;
}