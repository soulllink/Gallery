<script lang="ts">
    import type { ViewSettings } from '../stores';

    export let canvas: HTMLCanvasElement;
    export let image: HTMLImageElement | null = null;
    export let video: HTMLVideoElement | null = null;
    export let settings: ViewSettings;
    export let panX: number = 0;
    export let panY: number = 0;
    export let scrollOffset: number = 0;
    export let isOCRMode: boolean = false;
    export let selectionStart: { x: number; y: number } | null = null;
    export let selectionEnd: { x: number; y: number } | null = null;
    export let ocrResults: Array<{
        text: string;
        translation: string;
        x: number;
        y: number;
        w: number;
        h: number;
        visible: boolean;
        loading: boolean;
    }> = [];

    let ctx: CanvasRenderingContext2D | null;
    let videoContainer: HTMLDivElement;

    // --- FIX: Explicit Reactivity ---
    // We explicitly reference 'settings', 'panX', 'panY' etc. so Svelte knows
    // to re-run this block (and call draw) when they change.
    $: if (canvas && (image || video)) {
        settings; panX; panY; scrollOffset; isOCRMode; selectionStart; selectionEnd; ocrResults;
        draw();
    }

    export function draw() {
        if (!canvas || (!image && !video)) return;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const width = canvas.width = window.innerWidth;
        const height = canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);

        ctx.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)`;

        // If Video is present, we handle it via CSS Transform on the native element
        // we DO NOT draw it to canvas to save performance on large 4k files
        if (video && videoContainer) {
            // Ensure video element is in the DOM (it is passed as prop 'video', but we need to place it or use a local binding)
            // Actually, the parent passes the video OBJECT. We should probably append it to our container 
            // OR the parent should just handle the video element.
            // PROPOSAL: We will assume 'video' prop IS the element. We just need to ensure it is visible and positioned.
            // Wait, standardizing: The 'video' prop is created in MediaManager. It is not in the DOM by default.
            // We need to append it to our container if it's not there.
            if (video.parentElement !== videoContainer) {
                videoContainer.innerHTML = '';
                videoContainer.appendChild(video);
                video.style.position = 'absolute';
                video.style.transformOrigin = 'center center';
                video.style.pointerEvents = 'none'; // Let events pass to canvas
            }
        } else if (videoContainer) {
             videoContainer.innerHTML = '';
        }

        const media = image || video;
        if (!media) return;

        const mediaW = image ? image.width : (video as HTMLVideoElement).videoWidth;
        const mediaH = image ? image.height : (video as HTMLVideoElement).videoHeight;

        if (!mediaW || !mediaH) return;

        // Handle Rotation Logic
        const rotationRad = (settings.rotation * Math.PI) / 180;
        const isRotated90 = settings.rotation % 180 !== 0;

        // Effective dimensions for fitting logic
        const effectiveW = isRotated90 ? mediaH : mediaW;
        const effectiveH = isRotated90 ? mediaW : mediaH;

        let drawW = mediaW;
        let drawH = mediaH;
        let offsetX = panX;
        let offsetY = panY;

        // --- Logic matches CoordinateTransforms.ts ---
        // Calculate scale based on effective dimensions
        if (settings.viewMode === 'fit-h') {
            const scale = width / effectiveW;
            drawW = mediaW * scale;
            drawH = mediaH * scale;

            // Center vertically
            const finalH = isRotated90 ? drawW : drawH;
            offsetY = panY + (height - finalH) / 2;

            // If rotated, we need to adjust offset to center properly
            if (isRotated90) {
                 offsetX = panX + (width - drawH) / 2;
            }

        } else if (settings.viewMode === 'fit-v') {
            const scale = height / effectiveH;
            drawW = mediaW * scale;
            drawH = mediaH * scale;

            const finalW = isRotated90 ? drawH : drawW;
            offsetX = panX + (width - finalW) / 2;
             if (isRotated90) {
                 offsetY = panY + (height - drawW) / 2;
            }

        } else if (settings.viewMode === 'original') {
            const finalW = isRotated90 ? mediaH : mediaW;
            const finalH = isRotated90 ? mediaW : mediaH;
            offsetX = panX + (width - finalW) / 2;
            offsetY = panY + (height - finalH) / 2;
        } else if (settings.viewMode === 'reader') {
             const scale = width / effectiveW;
            drawW = mediaW * scale;
            drawH = mediaH * scale;
            const finalH = isRotated90 ? drawW : drawH;

            const maxOffset = Math.max(0, finalH - height);
            if (scrollOffset > maxOffset) scrollOffset = 0;
            offsetY = -scrollOffset + panY;
             if (isRotated90) {
                 offsetX = panX + (width - drawH) / 2;
            }
        } else if (settings.viewMode === 'landscape') {
            const scale = height / effectiveH;
            drawW = mediaW * scale;
            drawH = mediaH * scale;
             const finalW = isRotated90 ? drawH : drawW;

            const maxOffset = Math.max(0, finalW - width);
            if (scrollOffset > maxOffset) scrollOffset = 0;
            offsetX = -scrollOffset + panX;
             if (isRotated90) {
                 offsetY = panY + (height - drawW) / 2;
            }
        }

        // Apply zoom
        drawW *= settings.zoom;
        drawH *= settings.zoom;

        // Adjust offset for zoom to center
        if (settings.zoom !== 1) {
            const centerX = width / 2;
            const centerY = height / 2;
            offsetX = centerX - (centerX - offsetX) * settings.zoom;
            offsetY = centerY - (centerY - offsetY) * settings.zoom;
        }

        // Draw with rotation
        ctx.save();

        // Calculate the center point of the image on screen
        const cx = offsetX + (isRotated90 ? drawH : drawW) / 2;
        const cy = offsetY + (isRotated90 ? drawW : drawH) / 2;

        if (image) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotationRad);
            ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        } else if (video && videoContainer) {
            // Apply CSS transform to the video element
            // We need to map the canvas transforms to CSS
            // cx, cy is the center of the video on screen
            // drawW, drawH is the dimensions
            // rotationRad is rotation
            
            // Translate to center, rotate, then offset by half size to center the element
            video.style.width = `${drawW}px`;
            video.style.height = `${drawH}px`;
            // video.style.transform = `translate(${cx - drawW/2}px, ${cy - drawH/2}px) rotate(${settings.rotation}deg)`;
            
            // Better approach: Position at top-left 0,0 and use translate
            video.style.left = `${cx - drawW/2}px`;
            video.style.top = `${cy - drawH/2}px`;
            video.style.transform = `rotate(${settings.rotation}deg)`;
            
            // Apply filters to video too
            video.style.filter = ctx.filter;
        }

        ctx.filter = 'none';

        // --- FIX: Draw selection box AFTER image (Screen Space) ---
        // Removed 'isOCRMode' check so it draws whenever selectionStart/End exist.
        if (selectionStart && selectionEnd) {
            const x = Math.min(selectionStart.x, selectionEnd.x);
            const y = Math.min(selectionStart.y, selectionEnd.y);
            const w = Math.abs(selectionEnd.x - selectionStart.x);
            const h = Math.abs(selectionEnd.y - selectionStart.y);

            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.fillRect(x, y, w, h);
        }

        // Draw OCR Result Boxes
        if (ocrResults.length > 0) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotationRad);

            // Transform from image space to draw space
            ctx.translate(-drawW / 2, -drawH / 2);
            ctx.scale(drawW / mediaW, drawH / mediaH);

            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; // More subtle
            ctx.lineWidth = 2 / (drawW / mediaW);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.05)'; // Very subtle fill

            for (const res of ocrResults) {
                if (res.visible) {
                    ctx.strokeRect(res.x, res.y, res.w, res.h);
                    ctx.fillRect(res.x, res.y, res.w, res.h);
                }
            }
            ctx.restore();
        }
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
    bind:this={videoContainer}
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