import { get } from "svelte/store";
import { ollamaSettings } from "../stores";

export async function translateText(text: string): Promise<string> {
  const settings = get(ollamaSettings);

  const baseUrl = settings.url.replace(/\/$/, "");

  const prompt = `Translate the following text to ${settings.targetLanguage}.
Output valid JSON only: { "translation": "..." }
Do not output any other text.

Text to translate:
${text}`;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        prompt: prompt,
        stream: false,
        format: "json", // Request JSON format from Ollama
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
      return responseText
        .replace(/^{"translation":\s*"/, "")
        .replace(/"}$/, "")
        .trim();
    }
  } catch (error) {
    console.error("Translation error:", error);
    return "Translation failed";
  }
}

// lib/TranslationService.ts

export async function recognizeAndTranslateWithVision(
  imageDataUrl: string,
  targetLang: string = "English"
): Promise<Record<string, string>> {
  const settings = get(ollamaSettings);
  const modelToUse = settings.model || "qwen2.5-vl:8b";
  const baseUrl = settings.url.replace(/\/$/, "");

  const prompt = `Translate the following text to ${targetLang}.
Split text as it shown on image by regions top-to-bottom, left-to-right and map they to a region number and translation
Output valid JSON only: { "region_1": "...", "region_2": "..." }
Do not output any other text. Don't Overthink.`;

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [imageDataUrl.split(',')[1]]  // base64 part only
          }
        ],
        stream: false,
        options: {
          temperature: 0.3,
          num_ctx: 8192,
          top_p: 0.95,
          repeat_penalty: 1.05
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HTTP ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.message?.content || "";

    try {
      // Find JSON object in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole content if no braces found (unlikely if prompt followed)
        return JSON.parse(content);
      }
    } catch (e) {
      console.error("Failed to parse Vision JSON:", content);
      return { "error": "Failed to parse translation" };
    }

  } catch (err: any) {
    console.error("Vision model failed:", err);
    return { "error": err.message || "Vision model error" };
  }
}
