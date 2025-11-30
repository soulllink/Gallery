import { detectTextRegions } from '../OCRService';
import { recognizeSelection, recognizeFullImage } from '../OllamaOCRService';
import { screenToImageCoords, type TransformParams } from '../CoordinateTransforms';

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
}

// ... (Keep performOCR manual function as is) ...
export async function performOCR(
    selection: { x: number, y: number, w: number, h: number },
    media: { image: HTMLImageElement | null, video: HTMLVideoElement | null },
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
    ctx.fillRect(0,0, imgW, imgH);
    ctx.drawImage(source as any, imgX, imgY, imgW, imgH, 0, 0, imgW, imgH);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);

    const newResults = [...existingResults, {
        text: "Scanning...",
        translation: "Translating...",
        x: imgX,
        y: imgY + imgH + 5,
        w: imgW,
        h: 60,
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
    } catch (e) {
        newResults[resultIndex].translation = "Error: " + (e as Error).message;
        newResults[resultIndex].loading = false;
    }

    return newResults;
}

// --- AUTO MODE (Button Click) ---
export async function handleAutoOCR(
    media: { image: HTMLImageElement | null, video: HTMLVideoElement | null },
    targetLanguage: string
): Promise<OCRResultItem[]> {
    const source = media.image || media.video;
    if (!source) return [];

    const w = (source as any).width || (source as any).videoWidth;
    const h = (source as any).height || (source as any).videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(!ctx) return [];

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0,0, w, h);
    ctx.drawImage(source as any, 0, 0);
    const fullImageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    console.log("Starting Hybrid OCR...");

    const [tesseractBlocks, llmResults] = await Promise.all([
        detectTextRegions(canvas).catch(e => { console.error(e); return []; }),
        recognizeFullImage(fullImageDataUrl, targetLanguage).catch(e => { console.error(e); return []; })
    ]);

    console.log(`Merge Step: Zones found: ${tesseractBlocks.length}, LLM Items: ${llmResults.length}`);

    const finalResults: OCRResultItem[] = [];

    if (tesseractBlocks.length > 0 && llmResults.length > 0) {
        // Sort both lists layout-wise to increase match probability
        tesseractBlocks.sort(spatialSort);

        llmResults.forEach((item, index) => {
            if (index < tesseractBlocks.length) {
                // MATCH: We have a box and a text
                const box = tesseractBlocks[index].bbox;
                finalResults.push({
                    text: item.originalText,
                    translation: item.translation,
                    x: box.x0,
                    y: box.y0,
                    w: box.x1 - box.x0,
                    h: box.y1 - box.y0,
                    visible: true,
                    loading: false
                });
            } else {
                // ORPHAN: LLM found more text than Tesseract found boxes
                finalResults.push(createFallbackResult(item, w, h, index));
            }
        });
    } else {
        // FALLBACK: If Density found nothing, just show all LLM results at bottom
        llmResults.forEach((item, index) => {
            finalResults.push(createFallbackResult(item, w, h, index));
        });
    }

    // --- FIX: Force "Subtitle Mode" for Single Results ---
    // If we only have one result, users prefer it pinned to the bottom
    // rather than floating somewhere random.
    if (finalResults.length === 1) {
        finalResults[0].isFallback = true;
    }

    console.log("Final Results Generated:", finalResults.length);
    return finalResults;
}

function spatialSort(a: any, b: any) {
    const aY = a.bbox ? a.bbox.y0 : a.y;
    const bY = b.bbox ? b.bbox.y0 : b.y;
    const aX = a.bbox ? a.bbox.x0 : a.x;
    const bX = b.bbox ? b.bbox.x0 : b.x;

    if (Math.abs(aY - bY) > 50) return aY - bY;
    return aX - bX;
}

function createFallbackResult(item: {originalText: string, translation: string}, imgW: number, imgH: number, index: number): OCRResultItem {
    return {
        text: item.originalText,
        translation: item.translation,
        x: imgW * 0.1, // Dummy coords
        y: imgH - 100,
        w: imgW * 0.8,
        h: 80,
        visible: true,
        loading: false,
        isFallback: true // Triggers bottom-pinned CSS
    };
}