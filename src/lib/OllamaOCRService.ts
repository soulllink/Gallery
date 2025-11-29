import { get } from 'svelte/store';
import { ollamaSettings } from '../stores';

export interface OllamaOCRResult {
    originalText: string;
    translation: string;
}

export interface TextRegion {
    text: string;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}

/**
 * Compress canvas region to PNG base64
 */
export function compressRegionToPNG(canvas: HTMLCanvasElement, quality: number = 0.9): string {
    return canvas.toDataURL('image/png', quality);
}

/**
 * Extract region from source image as a new canvas
 */
export function extractRegion(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    return canvas;
}

/**
 * Perform OCR and translation using Ollama's vision model
 * @param imageDataUrl - Base64 encoded image data
 * @param targetLanguage - Target language for translation
 * @param textRegions - Optional text regions detected by Tesseract for context
 */
export async function recognizeAndTranslateWithOllama(
    imageDataUrl: string,
    targetLanguage: string,
    textRegions?: TextRegion[]
): Promise<OllamaOCRResult> {
    const settings = get(ollamaSettings);
    const baseUrl = settings.url.replace(/\/$/, '');

    // Extract base64 data from data URL
    const base64Data = imageDataUrl.split(',')[1];

    // Build prompt with optional region context
    let prompt = `You are an expert OCR system. Analyze this image and extract all visible text.`;

    if (textRegions && textRegions.length > 0) {
        prompt += `\n\nText regions detected (as hints):`;
        textRegions.forEach((region, idx) => {
            prompt += `\n- Region ${idx + 1}: "${region.text}" at position (${region.bbox.x0}, ${region.bbox.y0}) to (${region.bbox.x1}, ${region.bbox.y1})`;
        });
        prompt += `\n\nUse these hints to locate text, but perform your own OCR to get accurate results.`;
    }

    prompt += `\n\nTranslate all extracted text to ${targetLanguage}.

Output valid JSON only in this exact format:
{
    "originalText": "extracted text in original language",
    "translation": "translated text in ${targetLanguage}"
}

Do not output any other text or explanation.`;

    try {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.model,
                prompt: prompt,
                images: [base64Data],
                stream: false,
                format: "json"
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.response || 'No response';

        try {
            const json = JSON.parse(responseText);
            return {
                originalText: json.originalText || json.original || 'No text found',
                translation: json.translation || 'Translation unavailable'
            };
        } catch (e) {
            // Fallback to regex parsing if JSON fails
            const originalMatch = responseText.match(/"originalText":\s*"([^"]+)"/i) ||
                responseText.match(/"original":\s*"([^"]+)"/i);
            const translationMatch = responseText.match(/"translation":\s*"([^"]+)"/i);

            return {
                originalText: originalMatch ? originalMatch[1] : responseText.substring(0, 100),
                translation: translationMatch ? translationMatch[1] : 'Parsing failed'
            };
        }
    } catch (error) {
        console.error('Ollama vision OCR error:', error);
        return {
            originalText: 'Error',
            translation: `Vision recognition failed. Make sure ${settings.model} is available in Ollama.`
        };
    }
}

/**
 * Process multiple regions in parallel
 */
export async function batchRecognizeRegions(
    regions: Array<{ canvas: HTMLCanvasElement; bbox: any }>,
    targetLanguage: string
): Promise<Array<OllamaOCRResult & { bbox: any }>> {
    const results = await Promise.all(
        regions.map(async (region) => {
            const imageData = compressRegionToPNG(region.canvas);
            const result = await recognizeAndTranslateWithOllama(imageData, targetLanguage);
            return {
                ...result,
                bbox: region.bbox
            };
        })
    );
    return results;
}
