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

export async function recognizeText(imageSource: Tesseract.ImageLike, language: string = 'eng'): Promise<OCRBlock[]> {
    try {
        const worker = await Tesseract.createWorker(language, 1, {
            logger: m => console.log(m)
        });
        const ret = await worker.recognize(imageSource);
        await worker.terminate();

        // Map Tesseract blocks to our interface
        return ret.data.blocks?.map(block => ({
            text: block.text.trim(),
            bbox: block.bbox
        })).filter(b => b.text.length > 0) || [];
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}
