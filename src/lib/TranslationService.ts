import { get } from 'svelte/store';
import { ollamaSettings } from '../stores';

export async function translateText(text: string): Promise<string> {
    const settings = get(ollamaSettings);

    const baseUrl = settings.url.replace(/\/$/, '');

    const prompt = `Translate the following text to ${settings.targetLanguage}. Only output the translated text, no explanations:\n\n${text}`;

    try {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.model,
                prompt: prompt,
                stream: false
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response || 'Translation unavailable';
    } catch (error) {
        console.error('Translation error:', error);
        return 'Translation failed';
    }
}

export async function recognizeAndTranslateWithVision(imageDataUrl: string, targetLanguage: string): Promise<{ text: string, translation: string }> {
    const settings = get(ollamaSettings);
    const baseUrl = settings.url.replace(/\/$/, '');

    // Extract base64 data from data URL
    const base64Data = imageDataUrl.split(',')[1];

    const prompt = `Please recognize and translate any text in this image to ${targetLanguage}. 
    
Output format:
Original text: [the text you see in the image]
Translation: [translation to ${targetLanguage}]`;

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
                stream: false
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.response || 'No response';

        // Parse the response to extract original text and translation
        const originalMatch = responseText.match(/Original text:\s*(.+?)(?=\n|Translation:|$)/i);
        const translationMatch = responseText.match(/Translation:\s*(.+?)$/i);

        const originalText = originalMatch ? originalMatch[1].trim() : responseText;
        const translation = translationMatch ? translationMatch[1].trim() : responseText;

        return {
            text: originalText,
            translation: translation
        };
    } catch (error) {
        console.error('Vision translation error:', error);
        return {
            text: 'Error',
            translation: 'Vision recognition failed. Make sure you are using a vision-enabled model like llava or llama3.2-vision.'
        };
    }
}
