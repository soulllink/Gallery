// We no longer need Tesseract
// import Tesseract from 'tesseract.js';

export interface OCRBlock {
    text: string;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}

/**
 * REPLACEMENT: Visual Density Detector
 * Instead of reading text, we look for "Busy Zones" (high edge density).
 * This finds vague text, alien hieroglyphs, and messy handwriting
 * simply because they look "busy" compared to the background.
 */
export async function detectTextRegions(source: HTMLCanvasElement | HTMLImageElement, lang: string = 'jpn'): Promise<OCRBlock[]> {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        // 1. Resize for speed (we don't need 4k to find zones)
        const processScale = 0.5; // Process at 50% scale for speed
        const width = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
        const height = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;

        const w = Math.floor(width * processScale);
        const h = Math.floor(height * processScale);

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(source, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 2. Grid Configuration
        const tileSize = 20; // 20x20 pixel tiles
        const cols = Math.ceil(w / tileSize);
        const rows = Math.ceil(h / tileSize);
        const grid = new Uint8Array(cols * rows); // 0 = empty, 1 = text

        // 3. Edge Density Scan
        // We calculate the "Manhattan Distance" between adjacent pixels.
        // Text has VERY high variance between neighbors.
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let edgeScore = 0;

                // Scan pixels inside this tile
                const startX = x * tileSize;
                const startY = y * tileSize;
                const endX = Math.min(startX + tileSize, w);
                const endY = Math.min(startY + tileSize, h);

                for (let py = startY; py < endY; py += 2) { // Skip every other row for speed
                    for (let px = startX; px < endX - 1; px++) {
                        const i = (py * w + px) * 4;

                        // Convert to roughly Gray on the fly
                        const lum1 = (data[i] + data[i+1] + data[i+2]) / 3;
                        const lum2 = (data[i+4] + data[i+5] + data[i+6]) / 3;

                        // Difference (Edge)
                        if (Math.abs(lum1 - lum2) > 15) {
                            edgeScore++;
                        }
                    }
                }

                // Threshold: If tile has enough "scratchy" parts, it's text
                // Adjust this number: Lower = detects more vague stuff / noise
                if (edgeScore > (tileSize * tileSize * 0.05)) {
                    grid[y * cols + x] = 1;
                }
            }
        }

        // 4. Morphological Closing (Smear logic)
        // Connect isolated text tiles into blocks
        const smearedGrid = new Uint8Array(grid);

        // Horizontal Smear (connect letters)
        for (let y = 0; y < rows; y++) {
            for (let x = 1; x < cols - 1; x++) {
                const idx = y * cols + x;
                if (grid[idx-1] && grid[idx+1]) smearedGrid[idx] = 1;
            }
        }
        // Vertical Smear (connect lines)
        for (let y = 1; y < rows - 1; y++) {
            for (let x = 0; x < cols; x++) {
                const idx = y * cols + x;
                if (grid[idx - cols] && grid[idx + cols]) smearedGrid[idx] = 1;
            }
        }

        // 5. Clustering (Simple Blob Detection)
        const blocks: OCRBlock[] = [];
        const visited = new Uint8Array(cols * rows);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const idx = y * cols + x;
                if (smearedGrid[idx] === 1 && visited[idx] === 0) {
                    // Start a flood fill to find the full box
                    const bounds = floodFill(x, y, cols, rows, smearedGrid, visited);

                    // Filter tiny noise
                    if (bounds.w > 2 && bounds.h > 1) {
                        blocks.push({
                            text: "Detected Zone", // Placeholder
                            bbox: {
                                x0: Math.floor(bounds.x * tileSize / processScale),
                                y0: Math.floor(bounds.y * tileSize / processScale),
                                x1: Math.floor((bounds.x + bounds.w) * tileSize / processScale),
                                y1: Math.floor((bounds.y + bounds.h) * tileSize / processScale)
                            }
                        });
                    }
                }
            }
        }

        console.log(`Visual Density found ${blocks.length} zones.`);
        resolve(blocks);
    });
}

function floodFill(startX: number, startY: number, cols: number, rows: number, grid: Uint8Array, visited: Uint8Array) {
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    const stack = [{x: startX, y: startY}];
    visited[startY * cols + startX] = 1;

    while (stack.length > 0) {
        const p = stack.pop()!;

        // Update Bounds
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;

        // Check neighbors (4-way)
        const neighbors = [
            {x: p.x + 1, y: p.y}, {x: p.x - 1, y: p.y},
            {x: p.x, y: p.y + 1}, {x: p.x, y: p.y - 1}
        ];

        for (const n of neighbors) {
            if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows) {
                const idx = n.y * cols + n.x;
                if (grid[idx] === 1 && visited[idx] === 0) {
                    visited[idx] = 1;
                    stack.push(n);
                }
            }
        }
    }

    return { x: minX, y: minY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
}

/**
 * Wrapper for compatibility
 */
export async function recognizeText(source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement, lang: string = 'jpn'): Promise<OCRBlock[]> {
    if (source instanceof HTMLVideoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = source.videoWidth;
        canvas.height = source.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(source, 0, 0);
        return detectTextRegions(canvas, lang);
    }
    return detectTextRegions(source, lang);
}