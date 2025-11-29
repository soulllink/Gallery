## Gallery app

![Screenshot of my application](https://raw.githubusercontent.com/soulllink/Gallery/refs/heads/main/Image.png)

Gallery app is a modern, high-performance desktop gallery application for Windows, developed using Svelte, TypeScript, and Tauri. It provides not only basic media file viewing but also powerful tools for controlling video playback, image editing, and innovative OCR and translation features that run entirely locally thanks to Ollama.

## Key Features

Gallery app transforms ordinary media viewing into a powerful and customizable experience:

### Media Viewing

Universal Viewing: Supports images (JPEG, PNG, WEBP, etc.) and videos (MP4, MKV, etc.).

### Color Control:

Smooth real-time adjustment of color properties for images and videos (brightness, contrast, saturation, hue).

### Flexible Video Control:

Playback Speed: Speed adjustment from standard up to 4x for detailed analysis or accelerated viewing.

Extreme Volume: Audio amplification up to 600% for working with quiet soundtracks.

## Local AI Features (Powered by Ollama)

Integration with the local Ollama model ensures data privacy and processing speed:

Built-in OCR (Optical Character Recognition): Instant recognition of text in any image or video frame.

Contextual Translation: On-the-fly translation of recognized text, operating without the need to send data to remote servers.

## Macros and Automation

Macro Recorder: Recording sequences of user actions (key presses, data input) to automate repetitive tasks within the application.

Custom Keybindings: Assigning recorded macros to custom hotkeys for quick access to complex features or settings.

## Using AI Features

View Media: Open any image or video in the application.

Run OCR: Press the "Recognize Text" button (or the configured macro hotkey).

### Translate: Select the recognized text, press "Translate," and Ollama will perform the local translation, displaying the result.

Note: Ensure your local Ollama server is running before using these features.

### Macros (Keybindings & Recorder)

The "Settings" > "Macros" section allows you to:

Click "Record" and perform a sequence of actions (e.g., increase speed, apply filter, run OCR).

Click "Stop" and save the macro with a name.

Assign a key combination for instant execution of the recorded macro.
