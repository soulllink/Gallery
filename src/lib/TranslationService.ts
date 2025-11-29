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
): Promise<{ text: string; translation: string }> {
  const langName = {
    "English": "English",
    "Japanese": "Japanese",
    "Korean": "Korean",
    "Chinese": "Chinese",
    "Russian": "Russian",
    "Spanish": "Spanish",
    "French": "French",
    "German": "German",
    "Indonesian": "Indonesian",
    "Vietnamese": "Vietnamese",
    "Portuguese": "Portuguese"
  }[targetLang] || "English";

  const prompt = `You are a professional manga/manhwa translator.
Extract ALL visible text from the image EXACTLY as it appears (preserve line breaks, honorifics, sound effects, and formatting).
Then translate it naturally and fluently into ${langName}, keeping the tone, personality, and style of the original.

Respond using this exact format (no extra text):

ORIGINAL:
<all extracted text here>

<<SEP>>

TRANSLATED:
<your perfect translation here>`;

  const settings = get(ollamaSettings);
  const modelToUse = settings.model || "qwen2.5-vl:8b";
  const baseUrl = settings.url.replace(/\/$/, "");

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
          // These make Qwen-VL dramatically better at manga
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

    // Qwen sometimes uses <<SEPARATOR>> instead of <<SEP>>
    const separator = content.includes("<<SEP>>") ? "<<SEP>>" : "<<SEPARATOR>>";
    const parts = content.split(separator);

    if (parts.length < 2) {
      // Fallback: just return raw response
      return {
        text: "Text extraction failed (model didn't follow format)",
        translation: content.trim()
      };
    }

    return {
      text: parts[0].replace(/ORIGINAL:?\s*/i, "").trim(),
      translation: parts[1].replace(/TRANSLATED:?\s*/i, "").trim()
    };

  } catch (err: any) {
    console.error("Qwen-VL failed:", err);
    return {
      text: "Vision model error",
      translation: err.message || "Check Ollama is running qwen2.5-vl:8b"
    };
  }
}
