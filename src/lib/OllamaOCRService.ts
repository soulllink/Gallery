import { get } from 'svelte/store';
import { ollamaSettings } from '../stores';

export interface OllamaOCRResult {
    originalText: string;
    translation: string;
}

/**
 * 1. MANUAL MODE: Single Selection
 */
export async function recognizeSelection(imageDataUrl: string, targetLanguage: string): Promise<OllamaOCRResult> {
    const settings = get(ollamaSettings);
    const base64Data = imageDataUrl.split(',')[1];

    const prompt = `Transcribe text in image and translate to ${targetLanguage}.
Output strictly valid JSON:
{ "originalText": "...", "translation": "..." }`;

    return await callOllama(base64Data, prompt, settings, false);
}

/**
 * 2. AUTO MODE: Full Page
 */
export async function recognizeFullImage(imageDataUrl: string, targetLanguage: string): Promise<OllamaOCRResult[]> {
    const settings = get(ollamaSettings);
    const base64Data = imageDataUrl.split(',')[1];

    const prompt = `Find all text blocks. Transcribe and translate to ${targetLanguage}.
Order top-to-bottom.
Output strictly valid JSON Array:
[ { "originalText": "...", "translation": "..." } ]`;

    // We allow returning a single object if the LLM forgets the array brackets
    const result = await callOllama(base64Data, prompt, settings, true);
    return Array.isArray(result) ? result : [result];
}

/**
 * ROBUST API CALL & PARSER
 */
async function callOllama(base64Image: string, prompt: string, settings: any, expectArray: boolean): Promise<any> {
    const baseUrl = settings.url.replace(/\/$/, '');

    try {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: settings.model,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                format: "json",
                options: { temperature: 0.1 }
            }),
        });

        if (!response.ok) throw new Error(`Ollama Error: ${response.status}`);

        const data = await response.json();
        let rawResponse = data.response;

        // --- Handle 'thinking' field (common in Qwen/DeepSeek) ---
        if (!rawResponse && data.thinking) {
            console.warn("Empty 'response', using 'thinking' field as fallback.");
            rawResponse = data.thinking;
        }

        console.log("LLM Raw Output:", JSON.stringify(data));

        if (!rawResponse) return handleError("Empty response from LLM", expectArray);

        // 1. Clean Markdown
        rawResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Attempt Clean Parse
        try {
            return JSON.parse(rawResponse);
        } catch (e) {
            console.warn("Strict JSON Parse failed, attempting dirty extraction...");

            // 3. Robust Extraction (Find first {...} or [...])
            const jsonMatch = rawResponse.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error("Dirty JSON extraction failed:", e2);
                }
            }

            // 4. Fallback: Regex Extraction for Single Object
            // Even if we expect an array, if we find a single valid object, return it.
            const originalMatch = rawResponse.match(/"originalText"\s*:\s*"([^"]+)"/);
            const translationMatch = rawResponse.match(/"translation"\s*:\s*"([^"]+)"/);

            if (originalMatch || translationMatch) {
                const fallbackObj = {
                    originalText: originalMatch ? originalMatch[1] : "...",
                    translation: translationMatch ? translationMatch[1] : rawResponse
                };
                // If we expected an array, we return the object (caller will wrap it)
                return fallbackObj;
            }

            // 5. Total Failure
            return handleError("Could not parse JSON structure", expectArray);
        }
    } catch (error) {
        console.error('Ollama Service Error:', error);
        return handleError((error as Error).message, expectArray);
    }
}

function handleError(msg: string, expectArray: boolean) {
    console.error("Ollama Parse Error:", msg);
    if (expectArray) return [];
    return { originalText: "Error", translation: msg };
}