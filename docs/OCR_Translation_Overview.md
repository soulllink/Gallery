# OCR and Translation System Overview

## 1. Architecture Overview

The application uses a hybrid approach for OCR (Optical Character Recognition) and Translation, leveraging both local libraries and external LLMs (Large Language Models) via Ollama.

### Core Components:
- **`OCRService.ts`**: Handles local text detection using `tesseract.js`. This is primarily used to find *where* text is located on the image (bounding boxes).
- **`OllamaOCRService.ts`**: Handles interaction with Vision Language Models (VLMs) like `qwen2.5-vl` or `llama3.2-vision` running on Ollama. It extracts text and translates it.
- **`TranslationService.ts`**: Handles pure text translation using LLMs.
- **`CanvasView.svelte`**: The main UI component that coordinates user interactions (selection, auto-scan) and displays results.

## 2. Implementation Details

### Manual OCR (Shift + Click & Drag)
1.  **User Action**: User holds `Shift` and drags a selection box on the canvas.
2.  **Capture**: `CanvasView` captures the selected region coordinates.
3.  **Extraction**: A temporary canvas is created, and the selected region of the image/video is drawn onto it (`performOCR` in `CanvasView.svelte`).
4.  **Processing**:
    - The image data is sent to `recognizeText` (Tesseract) to check if there is text (optional check).
    - The image data is sent to `translateText` (if text was extracted locally) OR `recognizeAndTranslateWithVision` (if using Vision model).
5.  **Display**: Results are stored in `ocrResults` and rendered as overlays on the canvas.

### Auto OCR (Click OCR Button)
1.  **User Action**: User clicks the OCR button (without Shift).
2.  **Detection**: `OCRService.detectTextRegions` runs Tesseract on the *entire* visible image to find bounding boxes of all text regions.
3.  **Sorting**: Regions are sorted top-to-bottom, left-to-right (reading order).
4.  **Vision Analysis**: The *full* image is sent to the Vision LLM.
5.  **Prompting**: The LLM is prompted to extract ALL text and translate it, maintaining the structure.
6.  **Mapping**: The application attempts to map the LLM's output lines back to the detected Tesseract regions to place tooltips correctly.

## 3. COG Menu Options (Settings)

The Settings Modal (`SettingsModal.svelte`) provides configuration for the OCR/LLM backend:

-   **Ollama URL**: The endpoint for the Ollama server (default: `http://localhost:11434`).
-   **Model**: The specific LLM model to use (e.g., `llama3`, `qwen2.5-vl`). Fetched dynamically from the server.
-   **Target Language**: The language to translate *into* (e.g., "English").
-   **OCR Language**: The language hint for Tesseract (e.g., `jpn` for Japanese).
-   **Use Vision Model**: A checkbox to toggle between:
    -   **OFF**: Tesseract extracts text -> LLM translates text (Text-only pipeline).
    -   **ON**: Vision LLM extracts AND translates text from the image (Multimodal pipeline).

## 4. LLM Prompts & Payloads

### Text Translation (Text-only pipeline)
Used in `TranslationService.translateText`.

**Prompt:**
```text
Translate the following text to {targetLanguage}.
Output valid JSON only: { "translation": "..." }
Do not output any other text.

Text to translate:
{text}
```

**Payload:**
```json
{
  "model": "{settings.model}",
  "prompt": "{prompt}",
  "stream": false,
  "format": "json"
}
```

### Vision OCR & Translation (Multimodal pipeline)
Used in `TranslationService.recognizeAndTranslateWithVision`.

**Prompt:**
```text
You are a professional manga/manhwa translator.
Extract ALL visible text from the image EXACTLY as it appears (preserve line breaks, honorifics, sound effects, and formatting).
Then translate it naturally and fluently into {langName}, keeping the tone, personality, and style of the original.

Respond using this exact format (no extra text):

ORIGINAL:
<all extracted text here>

<<SEP>>

TRANSLATED:
<your perfect translation here>
```

**Payload:**
```json
{
  "model": "{modelToUse}",
  "messages": [
    {
      "role": "user",
      "content": "{prompt}",
      "images": ["{base64_image_data}"]
    }
  ],
  "stream": false,
  "options": {
    "temperature": 0.3,
    "num_ctx": 8192,
    "top_p": 0.95,
    "repeat_penalty": 1.05
  }
}
```
*Note: The `options` are tuned for Qwen-VL to improve stability and reduce hallucinations.*
