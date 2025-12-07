import { writable } from "svelte/store";

export interface FileItem {
  name: string;
  handle?: FileSystemFileHandle; // Make optional
  path?: string; // Add this for Tauri support
  type: "image" | "video" | "unknown";
  url?: string;
  dateModified: number;
  size: number;
}

export interface ViewSettings {
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  viewMode: "original" | "fit-h" | "fit-v" | "reader" | "landscape";
  videoSpeed: number;
  rotation: number;
  shift: boolean;
  volume: number;
  zoomSensitivity: number;
  panSensitivity: number;
}

export interface KeyBinding {
  action: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface MacroAction {
  type:
  | "navigate"
  | "zoom"
  | "pan"
  | "wait"
  | "viewMode"
  | "videoSpeed"
  | "rotation";
  value?: any;
  timestamp?: number;
}

export interface MacroSlot {
  name: string;
  actions: MacroAction[];
  keyBinding?: string;
}

export interface OllamaSettings {
  url: string;
  model: string;
  targetLanguage: string;
  ocrLanguage: string;
}

export const files = writable<FileItem[]>([]);
export const currentFileIndex = writable<number>(-1);
export const isLoading = writable<boolean>(false);

export function gotoFile(index: number) {
  currentFileIndex.update((curr) => {
    let length = 0;
    files.subscribe((list) => {
      length = list.length;
    })();
    if (length === 0) return curr;
    return Math.max(0, Math.min(index, length - 1));
  });
}

export const viewSettings = writable<ViewSettings>({
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  viewMode: "fit-h",
  videoSpeed: 1,
  rotation: 0,
  shift: false,
  volume: 100,
  zoomSensitivity: 1,
  panSensitivity: 1,
});

export const ollamaSettings = writable<OllamaSettings>({
  url: "http://localhost:11434",
  model: "qwen3-vl:8b",
  targetLanguage: "English",
  ocrLanguage: "jpn",
});

export const isMenuOpen = writable<boolean>(false);
export const isUIVisible = writable<boolean>(true);
export const isSettingsOpen = writable<boolean>(false);
export const isOCRMode = writable<boolean>(false);

// Keybindings store
export const keybindings = writable<KeyBinding[]>([
  { action: "nextFile", key: "PageDown" },
  { action: "prevFile", key: "PageUp" },
  { action: "panUp", key: "ArrowUp" },
  { action: "panDown", key: "ArrowDown" },
  { action: "panLeft", key: "ArrowLeft" },
  { action: "panRight", key: "ArrowRight" },
  { action: "toggleUI", key: "h" },
  { action: "firstFile", key: "Home" },
  { action: "lastFile", key: "End" },
  { action: "pauseScroll", key: " " },
  { action: "stopScroll", key: "Escape" },
]);

// Macro recording
export const macroSlots = writable<MacroSlot[]>(
  Array.from({ length: 10 }, (_, i) => ({
    name: `Macro ${i + 1}`,
    actions: [],
    keyBinding: i < 9 ? `${i + 1}` : "0",
  })),
);

export const isRecording = writable<boolean>(false);
export const currentRecordingSlot = writable<number>(-1);
export const recordedActions = writable<MacroAction[]>([]);
