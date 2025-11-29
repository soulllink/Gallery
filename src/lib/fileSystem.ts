import { files, currentFileIndex, isLoading } from '../stores';
import type { FileItem } from '../stores';

/**
 * Recursively collect files from a directory handle.
 */
async function collectFiles(dirHandle: FileSystemDirectoryHandle, fileList: FileItem[]) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            const type = getFileType(file.name);
            if (type !== 'unknown') {
                fileList.push({
                    name: file.name,
                    handle: fileHandle,
                    type,
                    dateModified: file.lastModified,
                    size: file.size
                });
            }
        } else if (entry.kind === 'directory') {
            const dirHandleChild = entry as FileSystemDirectoryHandle;
            await collectFiles(dirHandleChild, fileList);
        }
    }
}

export async function openDirectory() {
    try {
        // @ts-ignore - File System Access API types might be missing
        const dirHandle = await window.showDirectoryPicker();
        isLoading.set(true);
        const fileList: FileItem[] = [];
        await collectFiles(dirHandle, fileList);
        sortFiles(fileList, 'name');
        files.set(fileList);
        if (fileList.length > 0) {
            currentFileIndex.set(0);
        }
    } catch (err) {
        console.error('Error accessing directory:', err);
    } finally {
        isLoading.set(false);
    }
}

/**
 * Handle dropped files/folders
 */
export async function handleDrop(items: DataTransferItemList) {
    isLoading.set(true);
    const fileList: FileItem[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = await item.getAsFileSystemHandle();
            if (entry) {
                if (entry.kind === 'directory') {
                    await collectFiles(entry as FileSystemDirectoryHandle, fileList);
                } else if (entry.kind === 'file') {
                    const fileHandle = entry as FileSystemFileHandle;
                    const file = await fileHandle.getFile();
                    const type = getFileType(file.name);
                    if (type !== 'unknown') {
                        fileList.push({
                            name: file.name,
                            handle: fileHandle,
                            type,
                            dateModified: file.lastModified,
                            size: file.size
                        });
                    }
                }
            }
        }
    }

    if (fileList.length > 0) {
        sortFiles(fileList, 'name');
        files.set(fileList);
        currentFileIndex.set(0);
    }

    isLoading.set(false);
}

function getFileType(filename: string): 'image' | 'video' | 'unknown' {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
    if (imageExts.includes(ext || '')) return 'image';
    if (videoExts.includes(ext || '')) return 'video';
    return 'unknown';
}

/**
 * Sort the file list in-place.
 * method: 'name' | 'date' | 'type'
 */
export function sortFiles(list: FileItem[], method: 'name' | 'date' | 'type') {
    switch (method) {
        case 'name':
            list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            break;
        case 'date':
            list.sort((a, b) => a.dateModified - b.dateModified);
            break;
        case 'type':
            list.sort((a, b) => a.type.localeCompare(b.type));
            break;
    }
}

export async function getFileUrl(fileItem: FileItem): Promise<string> {
    if (fileItem.url) return fileItem.url;
    const file = await fileItem.handle.getFile();
    const url = URL.createObjectURL(file);
    fileItem.url = url;
    return url;
}
