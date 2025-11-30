import { recognizeText } from './OCRService';
import { translateText, recognizeAndTranslateWithVision } from './TranslationService';

export interface OCRResultItem {
    text: string;
    translation: string;
    x: number;
    y: number;
    w: number;
    h: number;
    visible: boolean;
    loading: boolean;
}

/**
 * Manual OCR - Uses Vision model directly (bypasses Tesseract)
 * This is called when user does Shift + Drag selection
 */
export async function performManualOCR(
    dataUrl: string,
    targetLanguage: string,
    imgX: number,
    imgY: number,
    imgW: number,
    imgH: number
): Promise<OCRResultItem> {
    console.log("Manual OCR - sending directly to Vision model");

    try {
        const resultMap = await recognizeAndTranslateWithVision(dataUrl, targetLanguage);

        // Vision model returns {region_1: "translation", ...}
        // For manual selection, we expect just one region
        const translation = resultMap.region_1 || resultMap[Object.keys(resultMap)[0]] || "No translation found";

        return {
            text: "",  // We don't have the original text since we skipped Tesseract
            translation: translation,
            x: imgX,
            y: imgY,
            w: imgW,
            h: imgH,
            visible: true,
            loading: false
        };
    } catch (error) {
        console.error("Vision OCR failed:", error);
        return {
            text: "Error",
            translation: "Failed to process image",
            x: imgX,
            y: imgY,
            w: imgW,
            h: imgH,
            visible: true,
            loading: false
        };
    }
}

/**
 * Auto OCR - Uses Tesseract for region detection, Vision for translation
 * Falls back to Vision on entire image if Tesseract finds nothing
 */
export async function performAutoOCR(
    source: HTMLImageElement | HTMLVideoElement,
    targetLanguage: string
): Promise<OCRResultItem[]> {
    // 1. Detect text regions (Tesseract)
    const regions = await recognizeText(source as any);

    // 2. Fallback: if Tesseract finds nothing, send entire image to Vision
    if (regions.length === 0) {
        console.log("Tesseract found no regions - falling back to Vision model on full image");

        // Create canvas with full image
        const canvas = document.createElement('canvas');
        canvas.width = (source as any).width || (source as any).videoWidth;
        canvas.height = (source as any).height || (source as any).videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        ctx.drawImage(source as any, 0, 0);
        const fullImageDataUrl = canvas.toDataURL('image/jpeg');

        try {
            const resultMap = await recognizeAndTranslateWithVision(fullImageDataUrl, targetLanguage);

            // Return a single result at bottom of screen
            return [{
                text: "",
                translation: resultMap.region_1 || resultMap[Object.keys(resultMap)[0]] || "No text detected",
                x: 0,
                y: canvas.height - 100,  // Bottom of screen
                w: canvas.width,
                h: 50,
                visible: true,
                loading: false
            }];
        } catch (error) {
            console.error("Fallback Vision OCR failed:", error);
            return [{
                text: "Error",
                translation: "OCR failed - no text detected",
                x: 0,
                y: canvas.height - 100,
                w: canvas.width,
                h: 50,
                visible: true,
                loading: false
            }];
        }
    }

    // 3. Sort regions (Top-Down, Left-Right)
    regions.sort((a, b) => {
        if (Math.abs(a.bbox.y0 - b.bbox.y0) > 50) {
            return a.bbox.y0 - b.bbox.y0;
        }
        return a.bbox.x0 - b.bbox.x0;
    });

    // 4. Get full image for Vision translation
    const canvas = document.createElement('canvas');
    canvas.width = (source as any).width || (source as any).videoWidth;
    canvas.height = (source as any).height || (source as any).videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(source as any, 0, 0);
    const fullImageDataUrl = canvas.toDataURL('image/jpeg');

    // 5. Translate full image using Vision Model
    const resultMap = await recognizeAndTranslateWithVision(fullImageDataUrl, targetLanguage);

    // 6. Map to regions
    const newResults: OCRResultItem[] = [];

    regions.forEach((region, index) => {
        const regionKey = `region_${index + 1}`;
        const translation = resultMap[regionKey] || "";

        if (translation) {
            newResults.push({
                text: region.text,
                translation: translation,
                x: region.bbox.x0,
                y: region.bbox.y0,
                w: region.bbox.x1 - region.bbox.x0,
                h: region.bbox.y1 - region.bbox.y0,
                visible: true,
                loading: false
            });
        }
    });

    return newResults;
}
