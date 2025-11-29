import { files, currentFileIndex, isLoading } from "../stores";
import type { FileItem } from "../stores";
import { convertFileSrc } from "@tauri-apps/api/core";
import { stat, readDir, readFile } from "@tauri-apps/plugin-fs"; // Added readFile
import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Recursively collect files from a directory handle (WEB).
 */
async function collectFiles(
  dirHandle: FileSystemDirectoryHandle,
  fileList: FileItem[],
) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const type = getFileType(file.name);
      if (type !== "unknown") {
        fileList.push({
          name: file.name,
          handle: fileHandle,
          type,
          dateModified: file.lastModified,
          size: file.size,
        });
      }
    } else if (entry.kind === "directory") {
      const dirHandleChild = entry as FileSystemDirectoryHandle;
      await collectFiles(dirHandleChild, fileList);
    }
  }
}

/**
 * Recursively collect files from a directory path (TAURI).
 */
async function collectTauriFiles(dirPath: string, fileList: FileItem[]) {
  try {
    const entries = await readDir(dirPath);

    for (const entry of entries) {
      const fullPath = await join(dirPath, entry.name);

      if (entry.isDirectory) {
        await collectTauriFiles(fullPath, fileList);
      } else if (entry.isFile) {
        await processTauriFile(fullPath, entry.name, fileList);
      }
    }
  } catch (err) {
    console.error("Error reading Tauri directory:", err);
  }
}

/**
 * Helper to process a single Tauri file and add it to the list
 */
async function processTauriFile(
  path: string,
  name: string,
  fileList: FileItem[],
) {
  const type = getFileType(name);
  if (type !== "unknown") {
    let metadata = { size: 0, mtime: Date.now() };
    try {
      const stats = await stat(path);
      metadata = {
        size: stats.size,
        mtime: stats.mtime ? new Date(stats.mtime).getTime() : Date.now(),
      };
    } catch (e) {
      console.warn("Could not read stats for", name);
    }

    fileList.push({
      name: name,
      path: path,
      type,
      dateModified: metadata.mtime,
      size: metadata.size,
    });
  }
}

export async function openDirectory() {
  try {
    isLoading.set(true);
    const fileList: FileItem[] = [];

    if (isTauri()) {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
      });

      if (selected && typeof selected === "string") {
        await collectTauriFiles(selected, fileList);
      }
    } else {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      await collectFiles(dirHandle, fileList);
    }

    if (fileList.length > 0) {
      sortFiles(fileList, "name");
      files.set(fileList);
      currentFileIndex.set(0);
    }
  } catch (err) {
    console.error("Error accessing directory:", err);
  } finally {
    isLoading.set(false);
  }
}

export async function handleDrop(items: DataTransferItemList) {
  isLoading.set(true);
  const fileList: FileItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const entry = await item.getAsFileSystemHandle();
      if (entry) {
        if (entry.kind === "directory") {
          await collectFiles(entry as FileSystemDirectoryHandle, fileList);
        } else if (entry.kind === "file") {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const type = getFileType(file.name);
          if (type !== "unknown") {
            fileList.push({
              name: file.name,
              handle: fileHandle,
              type,
              dateModified: file.lastModified,
              size: file.size,
            });
          }
        }
      }
    }
  }

  if (fileList.length > 0) {
    sortFiles(fileList, "name");
    files.set(fileList);
    currentFileIndex.set(0);
  }

  isLoading.set(false);
}

export async function handleTauriDrop(paths: string[]) {
  isLoading.set(true);

  const fileList: FileItem[] = [];

  for (const path of paths) {
    try {
      const stats = await stat(path);
      const name = path.split(/[\\/]/).pop() || path;

      if (stats.isDirectory) {
        await collectTauriFiles(path, fileList);
      } else {
        await processTauriFile(path, name, fileList);
      }
    } catch (e) {
      console.error("FAILED to process path:", path, e);
    }
  }

  if (fileList.length > 0) {
    sortFiles(fileList, "name");
    files.set(fileList);
    currentFileIndex.set(0);
  }
  isLoading.set(false);
}

function getFileType(filename: string): "image" | "video" | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase();
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
  const videoExts = ["mp4", "webm", "ogg", "mov"];
  if (imageExts.includes(ext || "")) return "image";
  if (videoExts.includes(ext || "")) return "video";
  return "unknown";
}

export function sortFiles(list: FileItem[], method: "name" | "date" | "type") {
  switch (method) {
    case "name":
      list.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      break;
    case "date":
      list.sort((a, b) => a.dateModified - b.dateModified);
      break;
    case "type":
      list.sort((a, b) => a.type.localeCompare(b.type));
      break;
  }
}

export async function getFileUrl(fileItem: FileItem): Promise<string> {
  if (fileItem.url) return fileItem.url;

  // 1. Handle Tauri Path (Desktop)
  if (fileItem.path && isTauri()) {
    try {
      // Read the file directly into memory (Bypasses Asset Server scope/encoding issues)
      const bytes = await readFile(fileItem.path);
      const blob = new Blob([bytes], {
        // Set correct mime type based on file extension
        type:
          fileItem.type === "video"
            ? getMimeType(fileItem.name)
            : getImageMimeType(fileItem.name),
      });
      const url = URL.createObjectURL(blob);
      fileItem.url = url;
      return url;
    } catch (e) {
      console.error("Failed to load file blob:", fileItem.path, e);
      // Fallback to asset protocol if blob fails (e.g. file too big)
      const url = convertFileSrc(fileItem.path);
      fileItem.url = url;
      return url;
    }
  }

  // 2. Handle Web FileHandle (Browser)
  if (fileItem.handle) {
    const file = await fileItem.handle.getFile();
    const url = URL.createObjectURL(file);
    fileItem.url = url;
    return url;
  }

  return "";
}

// Helper to get correct video mime types
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    default:
      return "video/mp4";
  }
}

// Helper for images (you can keep your existing logic or use this)
function getImageMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  return `image/${ext}`; // image/png, image/jpeg, etc.
}
