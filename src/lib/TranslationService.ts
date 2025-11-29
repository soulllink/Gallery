import { get } from 'svelte/store';
import { ollamaSettings } from '../stores';

export async function translateText(text: string): Promise<string> {
    const settings = get(ollamaSettings);

    const baseUrl = settings.url.replace(/\/$/, '');

    const prompt = `Translate the following text to ${settings.targetLanguage}. 
Output valid JSON only: { "translation": "..." }
Do not output any other text.

Text to translate:
${text}`;

    try {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.model,
                prompt: prompt,
                stream: false,
                format: "json" // Request JSON format from Ollama
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.response;

        try {
            const json = JSON.parse(responseText);
            return json.translation || responseText;
        } catch (e) {
            // Fallback if JSON parsing fails (e.g. model didn't output JSON)
            return responseText.replace(/^{"translation":\s*"/, '').replace(/"}$/, '').trim();
        }
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

    const prompt = `Recognize text in this image and translate it to ${targetLanguage}.
Output valid JSON only:
{
    "original": "text found in image",
    "translation": "translated text"
}
Do not output any other text.`;

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
                format: "json" // Request JSON format
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
                text: json.original || 'No text found',
                translation: json.translation || 'Translation unavailable'
            };
        } catch (e) {
            // Fallback to regex parsing if JSON fails
            const originalMatch = responseText.match(/"original":\s*"(.+?)"/i);
            const translationMatch = responseText.match(/"translation":\s*"(.+?)"/i);

            return {
                text: originalMatch ? originalMatch[1] : responseText,
                translation: translationMatch ? translationMatch[1] : 'Parsing failed'
            };
        }
    } catch (error) {
        console.error('Vision translation error:', error);
        return {
            text: 'Error',
            translation: 'Vision recognition failed. Make sure you are using a vision-enabled model like llava or llama3.2-vision.'
        };
    }
}
