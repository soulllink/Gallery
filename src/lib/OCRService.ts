import Tesseract from 'tesseract.js';

export interface OCRBlock {
    text: string;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}

/**
 * Preprocess image for better OCR results
 * Converts to grayscale and enhances contrast
 */
function preprocessImage(source: HTMLCanvasElement | HTMLImageElement): Promise<string> {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Get original dimensions
        const width = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
        const height = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;

        canvas.width = width;
        canvas.height = height;

        // Draw source
        ctx.drawImage(source, 0, 0);

        // Get image data
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Convert to grayscale and enhance contrast
        const contrast = 1.5; // Contrast factor
        const intercept = 128 * (1 - contrast);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Grayscale (luminosity method)
            let gray = 0.21 * r + 0.72 * g + 0.07 * b;

            // Contrast enhancement
            gray = gray * contrast + intercept;

            // Clamp values
            gray = Math.max(0, Math.min(255, gray));

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
    });
}

export async function recognizeText(source: HTMLCanvasElement | HTMLImageElement, lang: string = 'eng'): Promise<OCRBlock[]> {
    // Preprocess image for better OCR
    const preprocessedImage = await preprocessImage(source);

    const worker = await Tesseract.createWorker(lang);

    const { data } = await worker.recognize(preprocessedImage);
    await worker.terminate();

    // Extract blocks from the result
    const blocks: OCRBlock[] = [];

    if (data.blocks) {
        for (const block of data.blocks) {
            if (block.text && block.text.trim()) {
                blocks.push({
                    text: block.text.trim(),
                    bbox: {
                        x0: block.bbox.x0,
                        y0: block.bbox.y0,
                        x1: block.bbox.x1,
                        y1: block.bbox.y1
                    }
                });
            }
        }
    }

    return blocks;
}
