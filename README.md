# Gallery App

![Screenshot](https://raw.githubusercontent.com/soulllink/Gallery/refs/heads/main/Image.png)

A fast, modern desktop gallery application built with Svelte, TypeScript, and Tauri.

## Features

### Media Viewing
- Support for images (JPEG, PNG, WEBP, etc.) and videos (MP4, MKV, etc.)
- Multiple view modes: Original, Fit Horizontal, Fit Vertical, Reader, Landscape Scroll
- Canvas pan with mouse/arrow keys
- Zoom controls
- Image rotation
- Drag-and-drop files and folders

### Color Adjustments
- Real-time brightness, contrast, saturation, and hue control
- Applies to both images and videos

### Video Controls
- Playback speed adjustment (0.25x - 4x)
- Volume boost up to 600%
- Progress bar with seek functionality

### OCR & Translation (Powered by Ollama)
- Manual text recognition: Select any region to extract and translate text
- All processing happens locally on your machine
- Results cached in SQLite database for instant reload
- Draggable translation tooltips
- Privacy-focused: No data sent to external servers

### File Management
- Right-click context menu:
  - Open file in default application
  - Reveal in file explorer
  - Copy file
  - Delete file
  - View properties
- Search and filter files
- Sort by name, date created, date modified, or extension

### Macros
- Record sequences of actions
- Assign custom keybindings to macros
- 10 macro slots available

### Customization
- Configurable keybindings
- Pan sensitivity adjustment
- Zoom sensitivity adjustment

## Requirements

- [Ollama](https://ollama.ai/) running locally (for OCR/translation features)
- Vision-capable model (e.g., `qwen3-vl:8b`)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
