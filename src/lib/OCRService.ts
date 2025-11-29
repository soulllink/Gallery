import Tesseract from 'tesseract.js';

export async function recognizeText(imageSource: Tesseract.ImageLike, language: string = 'eng'): Promise<string> {
    try {
        const worker = await Tesseract.createWorker(language, 1, {
            logger: m => console.log(m)
        });
        const ret = await worker.recognize(imageSource);
        await worker.terminate();
        return ret.data.text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}
