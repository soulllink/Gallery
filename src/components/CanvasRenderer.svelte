<script lang="ts">
    import type { ViewSettings } from '../stores';

    export let canvas: HTMLCanvasElement;
    export let image: HTMLImageElement | null = null;
    export let video: HTMLVideoElement | null = null;
    export let isGif: boolean = false;
    export let settings: ViewSettings;
    export let panX: number = 0;
    export let panY: number = 0;
    export let scrollOffset: number = 0;
    export let isOCRMode: boolean = false;
    export let selectionStart: { x: number, y: number } | null = null;
    export let selectionEnd: { x: number, y: number } | null = null;
    export let ocrResults: any[] = [];
    
    let ctx: CanvasRenderingContext2D | null;
    let mediaContainer: HTMLDivElement;
    let lastDrawTime = 0;

    // ...

    export function draw() {
        if (!canvas || (!image && !video)) return;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Ensure canvas matches window size
        const width = canvas.width = window.innerWidth;
        const height = canvas.height = window.innerHeight;

        // 1. Setup Media Container (DOM Layer) for Video or GIF
        // We only append if not already appended to avoid reloading/flickering
        if ((video || (image && isGif)) && mediaContainer) {
            const element = video || image;
            if (element && element.parentElement !== mediaContainer) {
                mediaContainer.innerHTML = '';
                mediaContainer.appendChild(element);
                element.style.position = 'absolute';
                element.style.transformOrigin = 'center center';
                element.style.pointerEvents = 'none'; // Allow clicks to pass through to canvas
                element.style.willChange = 'transform, width, height, top, left';
            }
        } else if (mediaContainer) {
            mediaContainer.innerHTML = '';
        }

        const media = image || video;
        if (!media) return;

        // 2. Clear Canvas
        ctx.clearRect(0, 0, width, height);

        // 3. Determine Dimensions
        const mediaW = image ? image.width : (video as HTMLVideoElement).videoWidth;
        const mediaH = image ? image.height : (video as HTMLVideoElement).videoHeight;
        
        if (!mediaW || !mediaH) return;

        // 4. Calculate Draw Dimensions based on View Mode
        const rotationRad = (settings.rotation * Math.PI) / 180;
        const isRotated90 = settings.rotation % 180 !== 0;
        const effectiveW = isRotated90 ? mediaH : mediaW;
        const effectiveH = isRotated90 ? mediaW : mediaH;

        let drawW = mediaW;
        let drawH = mediaH;
        let offsetX = panX;
        let offsetY = panY;

        switch (settings.viewMode) {
            case 'fit-h': {
                const scale = width / effectiveW;
                drawW = mediaW * scale;
                drawH = mediaH * scale;
                const finalH = isRotated90 ? drawW : drawH;
                offsetY = panY + (height - finalH) / 2;
                if (isRotated90) offsetX = panX + (width - drawH) / 2;
                break;
            }
            case 'fit-v': {
                const scale = height / effectiveH;
                drawW = mediaW * scale;
                drawH = mediaH * scale;
                const finalW = isRotated90 ? drawH : drawW;
                offsetX = panX + (width - finalW) / 2;
                if (isRotated90) offsetY = panY + (height - drawW) / 2;
                break;
            }
            case 'reader': {
                const scale = width / effectiveW;
                drawW = mediaW * scale;
                drawH = mediaH * scale;
                offsetY = -scrollOffset + panY;
                if (isRotated90) offsetX = panX + (width - drawH) / 2;
                break;
            }
            case 'landscape': {
                const scale = height / effectiveH;
                drawW = mediaW * scale;
                drawH = mediaH * scale;
                offsetX = -scrollOffset + panX;
                if (isRotated90) offsetY = panY + (height - drawW) / 2;
                break;
            }
            case 'original':
            default: {
                // Center originally
                const finalW = isRotated90 ? mediaH : mediaW;
                const finalH = isRotated90 ? mediaW : mediaH;
                offsetX = panX + (width - finalW) / 2;
                offsetY = panY + (height - finalH) / 2;
                break;
            }
        }

        // 5. Apply Zoom
        drawW *= settings.zoom;
        drawH *= settings.zoom;

        // 6. Adjust offset for Zoom (centering logic)
        if (settings.zoom !== 1) {
            const centerX = width / 2;
            const centerY = height / 2;
            offsetX = centerX - (centerX - offsetX) * settings.zoom;
            offsetY = centerY - (centerY - offsetY) * settings.zoom;
        }

        // 7. Calculate Center of the Image on Screen
        // This is the anchor point for rotation
        const cx = offsetX + (isRotated90 ? drawH : drawW) / 2;
        const cy = offsetY + (isRotated90 ? drawW : drawH) / 2;

        // 8. Apply Filters
        const filterString = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)`;

        // 9. Render
        if (image && !isGif) {
            // Render Static Image to Canvas
            ctx.filter = filterString;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotationRad);
            // Draw centered at (0,0) in rotated context
            ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        } else if ((video || (image && isGif)) && mediaContainer) {
            // Update DOM Element (Video or GIF)
            const element = video || image;
            if (element) {
                element.style.width = `${drawW}px`;
                element.style.height = `${drawH}px`;
                // Position element so its center aligns with cx, cy
                element.style.left = `${cx - drawW / 2}px`;
                element.style.top = `${cy - drawH / 2}px`;
                element.style.transform = `rotate(${settings.rotation}deg)`;
                element.style.filter = filterString;
            }
        }

        // 10. Draw Overlays (Selection / OCR)
        // Draw Selection Box
        if (selectionStart && selectionEnd) {
            ctx.filter = 'none'; // Reset filter for UI
            const startX = selectionStart.x;
            const startY = selectionStart.y;
            const w = selectionEnd.x - startX;
            const h = selectionEnd.y - startY;

            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(startX, startY, w, h);
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fillRect(startX, startY, w, h);
        }
        
        // Highlights for OCR results usually handled by overlay components, 
        // but if we were drawing them on canvas:
        /* 
        if (ocrResults && ocrResults.length > 0) {
           // ... drawing code would go here
        }
        */
    }
</script>

<canvas
    bind:this={canvas}
    class="main-canvas"
    style="--cursor: {isOCRMode ? 'crosshair' : 'default'}"
    on:pointerdown
    on:pointermove
    on:pointerup
    on:pointercancel
    on:wheel
></canvas>

<div 
    class="video-layer" 
    bind:this={mediaContainer}
></div>

<style>
    .main-canvas {
        display: block;
        width: 100%;
        height: 100%;
        background-color: transparent; /* Changed to transparent so video shows through */
        position: relative;
        z-index: 10;
        cursor: var(--cursor, default);
    }
    
    .video-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        z-index: 5; /* Below canvas */
        background-color: #000; /* Background for the video area */
    }
</style>