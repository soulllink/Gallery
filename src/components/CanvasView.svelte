<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { files, currentFileIndex, viewSettings, keybindings, isRecording, recordedActions, macroSlots, isOCRMode, ollamaSettings, isUIVisible } from '../stores';
    import { getFileUrl } from '../lib/fileSystem';
    import { recognizeText } from '../lib/OCRService';
    import { translateText } from '../lib/TranslationService';
    import type { FileItem, MacroAction } from '../stores';

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null;
    let image: HTMLImageElement | null = null;
    let video: HTMLVideoElement | null = null;
    let videoFrame: number | null = null;
    let scrollFrame: number | null = null;
    let currentUrl: string | null = null;
    let scrollOffset = 0;
    let lastTimestamp = 0;
    let isScrolling = false;

    // Pan state
    let panX = 0;
    let panY = 0;
    const PAN_SPEED = 20;

    $: fileItem = $files[$currentFileIndex];
    $: settings = $viewSettings;

    // Live update on settings change
    $: if (settings && (image || video)) {
        if (video) {
            video.playbackRate = settings.videoSpeed;
            video.volume = Math.min(settings.volume / 100, 6);
        }
        draw();
    }

    $: if (fileItem) {
        loadFile(fileItem);
    }

    $: if (image || video) {
        draw();
    }

    let previousFileItem: FileItem | null = null;

    async function loadFile(item: FileItem) {
        stopAutoScroll();
        if (video) {
            video.pause();
            video.src = '';
            if (videoFrame) cancelAnimationFrame(videoFrame);
            videoFrame = null;
        }
        
        // Clear the cached URL from the previous file before revoking it
        if (previousFileItem && previousFileItem.url) {
            const oldUrl = previousFileItem.url;
            previousFileItem.url = undefined; // Clear the cache
            setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
        }
        
        try {
            currentUrl = await getFileUrl(item);
            previousFileItem = item; // Track the current item
        } catch (e) {
            console.error("Failed to get file URL", e);
            return;
        }

        scrollOffset = 0;
        panX = 0;
        panY = 0;
        // Reset rotation on new file? Maybe keep it? User might want to keep rotation.
        // Let's keep it for now as per "view settings" persistence.

        if (item.type === 'image') {
            video = null;
            image = new Image();
            image.onload = () => {
                draw();
                if (settings.viewMode === 'reader' || settings.viewMode === 'landscape') {
                    startAutoScroll();
                }
            };
            image.onerror = () => {
                console.error('Failed to load image:', item.name);
            };
            image.src = currentUrl;
        } else if (item.type === 'video') {
            image = null;
            video = document.createElement('video');
            video.src = currentUrl;
            video.loop = true;
            video.muted = false; // Enable sound
            video.volume = Math.min(settings.volume / 100, 6); // 0-600% mapped to 0-6 (max browser allows)
            video.onloadeddata = () => {
                draw();
                startVideoLoop();
            };
            video.onerror = (e) => {
                console.error('Failed to load video:', item.name, e);
            };
            video.play().catch(e => console.error("Auto-play failed", e));
        }
    }

    function startVideoLoop() {
        if (!video) return;
        function loop() {
            draw();
            videoFrame = requestAnimationFrame(loop);
        }
        loop();
    }

    function startAutoScroll() {
        stopAutoScroll();
        isScrolling = true;
        lastTimestamp = performance.now();
        scrollFrame = requestAnimationFrame(stepAutoScroll);
    }

    function stopAutoScroll() {
        isScrolling = false;
        if (scrollFrame) {
            cancelAnimationFrame(scrollFrame);
            scrollFrame = null;
        }
    }

    function stepAutoScroll(timestamp: number) {
        if (!isScrolling) return;
        const delta = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        const speed = 30;
        scrollOffset += (speed * delta) / 1000;
        draw();
        scrollFrame = requestAnimationFrame(stepAutoScroll);
    }

    // Pointer Events
    let isPointerDown = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let panStartX = 0;
    let panStartY = 0;
    
    // Zoom recording
    let zoomDebounceTimer: number;
    let accumulatedZoomDelta = 0;
    
    // OCR Selection
    let selectionStart: { x: number, y: number } | null = null;
    let selectionEnd: { x: number, y: number } | null = null;

    
    interface OCRResultItem {
        text: string;
        translation: string;
        x: number;
        y: number;
        w: number;
        h: number;
        visible: boolean;
        loading: boolean;
    }
    
    let ocrResults: OCRResultItem[] = [];

    function handlePointerDown(e: PointerEvent) {
        if ($isOCRMode) {
            selectionStart = { x: e.clientX, y: e.clientY };
            selectionEnd = { x: e.clientX, y: e.clientY };
            // Don't clear results on new selection, maybe? Or clear? Let's clear manual selection results but keep auto?
            // For now, clear all to avoid clutter
            ocrResults = []; 
        } else {
            isPointerDown = true;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            panStartX = panX;
            panStartY = panY;
        }
        canvas.setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: PointerEvent) {
        if ($isOCRMode) {
            if (selectionStart) {
                selectionEnd = { x: e.clientX, y: e.clientY };
                draw();
            }
        } else {
            if (!isPointerDown) return;
            
            const dx = e.clientX - lastPointerX;
            const dy = e.clientY - lastPointerY;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;

            panX += dx;
            panY += dy;
            draw();
        }
    }

    async function handlePointerUp(e: PointerEvent) {
        canvas.releasePointerCapture(e.pointerId);
        
        if ($isOCRMode && selectionStart && selectionEnd) {
            const startX = Math.min(selectionStart.x, selectionEnd.x);
            const startY = Math.min(selectionStart.y, selectionEnd.y);
            const w = Math.abs(selectionEnd.x - selectionStart.x);
            const h = Math.abs(selectionEnd.y - selectionStart.y);

            selectionStart = null;
            selectionEnd = null;
            draw(); // Clear selection box

            if (w > 10 && h > 10) {
                performOCR(startX, startY, w, h);
            }
        } else {
            if (isPointerDown) {
                // Calculate total pan distance
                const totalDx = panX - panStartX;
                const totalDy = panY - panStartY;
                
                if (Math.abs(totalDx) > 1 || Math.abs(totalDy) > 1) {
                    recordAction({ 
                        type: 'pan', 
                        value: { x: totalDx, y: totalDy } 
                    });
                }
            }
            isPointerDown = false;
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.001;
        const newZoom = Math.max(0.1, Math.min(5, settings.zoom + zoomDelta));
        viewSettings.update(v => ({ ...v, zoom: newZoom }));
        
        // Record zoom
        if ($isRecording) {
            accumulatedZoomDelta += zoomDelta;
            clearTimeout(zoomDebounceTimer);
            zoomDebounceTimer = window.setTimeout(() => {
                if (Math.abs(accumulatedZoomDelta) > 0.001) {
                    recordAction({ type: 'zoom', value: accumulatedZoomDelta });
                    accumulatedZoomDelta = 0;
                }
            }, 500);
        }
    }

    function getEdgePosition(edge: 'top' | 'bottom' | 'left' | 'right'): number {
        if (!canvas || (!image && !video)) return 0;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const media = image || video;
        const mediaW = image ? image.width : (video as HTMLVideoElement).videoWidth;
        const mediaH = image ? image.height : (video as HTMLVideoElement).videoHeight;
        
        if (!mediaW || !mediaH) return 0;

        const isRotated90 = settings.rotation % 180 !== 0;
        const effectiveW = isRotated90 ? mediaH : mediaW;
        const effectiveH = isRotated90 ? mediaW : mediaH;

        let drawW = mediaW;
        let drawH = mediaH;

        // Calculate dimensions based on view mode
        if (settings.viewMode === 'fit-h' || settings.viewMode === 'reader') {
            const scale = width / effectiveW;
            drawW *= scale;
            drawH *= scale;
        } else if (settings.viewMode === 'fit-v' || settings.viewMode === 'landscape') {
            const scale = height / effectiveH;
            drawW *= scale;
            drawH *= scale;
        }

        const finalW = isRotated90 ? drawH : drawW;
        const finalH = isRotated90 ? drawW : drawH;

        // Calculate edge positions
        switch (edge) {
            case 'top':
                // Show top of image
                return finalH > height ? (finalH - height) / 2 : 0;
            case 'bottom':
                // Show bottom of image
                return finalH > height ? -(finalH - height) / 2 : 0;
            case 'left':
                // Show left of image
                return finalW > width ? (finalW - width) / 2 : 0;
            case 'right':
                // Show right of image  
                return finalW > width ? -(finalW - width) / 2 : 0;
            default:
                return 0;
        }
    }

    function draw() {
        if (!canvas || (!image && !video)) return;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const width = canvas.width = window.innerWidth;
        const height = canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, width, height);

        ctx.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)`;

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

        // Adjust offset for zoom to center (simplified)
        if (settings.zoom !== 1) {
            const centerX = width / 2;
            const centerY = height / 2;
            offsetX = centerX - (centerX - offsetX) * settings.zoom;
            offsetY = centerY - (centerY - offsetY) * settings.zoom;
        }

        // Draw with rotation
        ctx.save();
        
        // Move to center of where we want to draw
        // This is tricky with offsets. 
        // Let's simplify: translate to the center of the image position, rotate, then draw centered at 0,0
        
        // Calculate the center point of the image on screen
        // For unrotated: x = offsetX, y = offsetY
        // But we want to rotate around the center of the image
        
        // Let's rely on the fact that we want the image at offsetX, offsetY (top-left corner usually)
        // But with rotation, top-left changes.
        
        // Easier approach:
        // Translate to the center of the canvas + pan
        // Rotate
        // Draw image centered
        
        // But our view modes calculate top-left offsets.
        // Let's translate to the calculated center of the image.
        
        // Center of the image if it were not rotated:
        const cx = offsetX + (isRotated90 ? drawH : drawW) / 2;
        const cy = offsetY + (isRotated90 ? drawW : drawH) / 2;
        
        ctx.translate(cx, cy);
        ctx.rotate(rotationRad);
        ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
        
        ctx.restore();
        ctx.filter = 'none';

        // Draw selection box (OCR) - needs to be on top, not rotated (or maybe rotated?)
        // Usually selection is screen-space.
        if ($isOCRMode && selectionStart && selectionEnd) {
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
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            
            for (const res of ocrResults) {
                if (res.visible) {
                    ctx.strokeRect(res.x, res.y, res.w, res.h);
                    ctx.fillRect(res.x, res.y, res.w, res.h);
                }
            }
        }
    }

    async function performOCR(x: number, y: number, w: number, h: number) {
        // Add placeholder result
        const resultId = Date.now();
        const newResult: OCRResultItem = {
            text: '',
            translation: '',
            x: x,
            y: y,
            w: w,
            h: h,
            visible: true,
            loading: true
        };
        
        ocrResults = [...ocrResults, newResult];
        const resultIndex = ocrResults.length - 1;

        try {
            const imageData = ctx!.getImageData(x, y, w, h);
            
            if ($ollamaSettings.useVision) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx!.putImageData(imageData, 0, 0);
                const dataUrl = tempCanvas.toDataURL('image/png');
                
                const { recognizeAndTranslateWithVision } = await import('../lib/TranslationService');
                const result = await recognizeAndTranslateWithVision(dataUrl, $ollamaSettings.targetLanguage);
                
                ocrResults[resultIndex] = { ...ocrResults[resultIndex], loading: false, text: result.text, translation: result.translation };
            } else {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx!.putImageData(imageData, 0, 0);

                // Note: recognizeText now returns OCRBlock[] but for manual selection we might just want the text?
                // Actually, let's use the first block or join them?
                // For manual selection, we usually expect one block or we just want the text.
                // Let's join all text found in the selection.
                const blocks = await recognizeText(tempCanvas, $ollamaSettings.ocrLanguage);
                const text = blocks.map(b => b.text).join('\n');
                
                if (!text.trim()) {
                    ocrResults[resultIndex] = { ...ocrResults[resultIndex], loading: false, text: 'No text found', translation: '' };
                    return;
                }

                ocrResults[resultIndex] = { ...ocrResults[resultIndex], text: text.trim() };
                const translation = await translateText(text);
                ocrResults[resultIndex] = { ...ocrResults[resultIndex], loading: false, translation };
            }
        } catch (err) {
            console.error(err);
            ocrResults[resultIndex] = { ...ocrResults[resultIndex], loading: false, text: 'Error', translation: 'Failed' };
        }
    }

    async function handleAutoOCR() {
        if (!canvas) return;
        
        ocrResults = []; // Clear previous
        
        // 1. Capture full canvas (or visible area?)
        // Let's do visible area to match what user sees
        const width = canvas.width;
        const height = canvas.height;
        
        // We need the image data of the canvas
        // But wait, the canvas has the image drawn on it.
        // We can just use the canvas itself as source for Tesseract
        
        try {
            // Use Tesseract to find text blocks
            const blocks = await recognizeText(canvas, $ollamaSettings.ocrLanguage);
            
            // Create result items for each block
            ocrResults = blocks.map(block => ({
                text: block.text,
                translation: 'Translating...',
                x: block.bbox.x0,
                y: block.bbox.y0,
                w: block.bbox.x1 - block.bbox.x0,
                h: block.bbox.y1 - block.bbox.y0,
                visible: true,
                loading: true
            }));
            
            draw(); // Draw boxes
            
            // Now translate each block
            // We can do this in parallel
            await Promise.all(ocrResults.map(async (res, i) => {
                try {
                    const translation = await translateText(res.text);
                    ocrResults[i] = { ...ocrResults[i], loading: false, translation };
                } catch (e) {
                    ocrResults[i] = { ...ocrResults[i], loading: false, translation: 'Failed' };
                }
            }));
            
        } catch (e) {
            console.error("Auto OCR Failed", e);
        }
    }

    let resizeTimeout: number;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => draw(), 100);
    }

    function executeAction(action: string) {
        switch (action) {
            case 'nextFile':
                currentFileIndex.update(i => Math.min(i + 1, $files.length - 1));
                recordAction({ type: 'navigate', value: 1 });
                break;
            case 'prevFile':
                currentFileIndex.update(i => Math.max(i - 1, 0));
                recordAction({ type: 'navigate', value: -1 });
                break;
            case 'panUp':
                if (settings.shift) {
                    // Jump to top edge
                    panY = getEdgePosition('top');
                } else {
                    panY += PAN_SPEED;
                }
                draw();
                recordAction({ type: 'pan', value: { x: 0, y: settings.shift ? getEdgePosition('top') : PAN_SPEED } });
                break;
            case 'panDown':
                if (settings.shift) {
                    // Jump to bottom edge
                    panY = getEdgePosition('bottom');
                } else {
                    panY -= PAN_SPEED;
                }
                draw();
                recordAction({ type: 'pan', value: { x: 0, y: settings.shift ? getEdgePosition('bottom') : -PAN_SPEED } });
                break;
            case 'panLeft':
                if (settings.shift) {
                    // Jump to left edge
                    panX = getEdgePosition('left');
                } else {
                    panX += PAN_SPEED;
                }
                draw();
                recordAction({ type: 'pan', value: { x: settings.shift ? getEdgePosition('left') : PAN_SPEED, y: 0 } });
                break;
            case 'panRight':
                if (settings.shift) {
                    // Jump to right edge
                    panX = getEdgePosition('right');
                } else {
                    panX -= PAN_SPEED;
                }
                draw();
                recordAction({ type: 'pan', value: { x: settings.shift ? getEdgePosition('right') : -PAN_SPEED, y: 0 } });
                break;
            case 'firstFile':
                currentFileIndex.set(0);
                break;
            case 'lastFile':
                currentFileIndex.set($files.length - 1);
                break;
            case 'pauseScroll':
                if (video) {
                    video.paused ? video.play() : video.pause();
                } else if (isScrolling) {
                    stopAutoScroll();
                } else {
                    startAutoScroll();
                }
                break;
            case 'stopScroll':
                stopAutoScroll();
                break;
            case 'toggleUI':
                isUIVisible.update(v => !v);
                break;
        }
    }

    function recordAction(action: MacroAction) {
        if ($isRecording) {
            recordedActions.update(actions => [...actions, { ...action, timestamp: Date.now() }]);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        // Rotation
        if (e.key === 'r' || e.key === 'R') {
            viewSettings.update(s => ({ ...s, rotation: (s.rotation + 90) % 360 }));
            return;
        }

        // Check for macro keybindings first
        const macroSlot = $macroSlots.find(slot => 
            slot.keyBinding && 
            slot.keyBinding === e.key && 
            slot.actions.length > 0
        );
        
        if (macroSlot) {
            e.preventDefault();
            playMacro(macroSlot.actions);
            return;
        }

        // Ignore if typing in a text input (but allow range inputs for sliders)
        if (e.target instanceof HTMLInputElement && (e.target.type === 'text' || e.target.type === 'number' || e.target.type === 'search' || e.target.type === 'password')) {
            return;
        }
        if (e.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Update shift state in settings for use in executeAction
        if (e.shiftKey !== settings.shift) {
             viewSettings.update(s => ({ ...s, shift: e.shiftKey }));
        }

        // Find matching keybinding
        // For arrow keys (pan actions), ignore the shift modifier in matching
        const isPanKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
        
        const binding = $keybindings.find(b => {
            if (isPanKey) {
                // For pan keys, only match key, ctrl, and alt (ignore shift)
                return b.key === e.key &&
                       !!b.ctrl === e.ctrlKey &&
                       !!b.alt === e.altKey;
            } else {
                // For other keys, match all modifiers exactly
                return b.key === e.key &&
                       !!b.ctrl === e.ctrlKey &&
                       !!b.shift === e.shiftKey &&
                       !!b.alt === e.altKey;
            }
        });

        if (binding) {
            e.preventDefault();
            executeAction(binding.action);
        }
    }

    function playMacro(actions: MacroAction[]) {
        let actionIndex = 0;
        
        function executeNext() {
            if (actionIndex >= actions.length) return;
            
            const action = actions[actionIndex];
            actionIndex++;
            
            // Execute action based on type
            switch (action.type) {
                case 'navigate':
                    if (action.value > 0) {
                        currentFileIndex.update(i => Math.min(i + action.value, $files.length - 1));
                    } else {
                        currentFileIndex.update(i => Math.max(i + action.value, 0));
                    }
                    break;
                case 'pan':
                    panX += action.value.x || 0;
                    panY += action.value.y || 0;
                    draw();
                    break;
                case 'viewMode':
                    viewSettings.update(v => ({ 
                        ...v, 
                        viewMode: action.value,
                        zoom: (action.value === 'fit-h' || action.value === 'fit-v') ? 1 : v.zoom
                    }));
                    break;
                case 'zoom':
                    viewSettings.update(v => ({ ...v, zoom: Math.max(0.1, Math.min(5, v.zoom + action.value)) }));
                    draw();
                    break;
                case 'rotation':
                     viewSettings.update(v => ({ ...v, rotation: action.value }));
                     break;
                case 'wait':
                    setTimeout(executeNext, action.value || 0);
                    return;
            }
            
            // Continue with next action after a small delay
            setTimeout(executeNext, 10);
        }
        
        executeNext();
    }

    // Listen for macro playback events from MacroRecorder
    function handleMacroPlay(e: CustomEvent) {
        playMacro(e.detail);
    }

    onMount(() => {
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('playMacro', handleMacroPlay as EventListener);
        window.addEventListener('triggerAutoOCR', handleAutoOCR);
    });

    onDestroy(() => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('playMacro', handleMacroPlay as EventListener);
        window.removeEventListener('triggerAutoOCR', handleAutoOCR);
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        if (videoFrame) cancelAnimationFrame(videoFrame);
        if (video) {
            video.pause();
            video.src = '';
        }
        if (currentUrl) URL.revokeObjectURL(currentUrl);
    });
</script>

<canvas 
    bind:this={canvas} 
    class="main-canvas"
    style="--cursor: {$isOCRMode ? 'crosshair' : 'default'}"
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
    on:wheel={handleWheel}
></canvas>

{#each ocrResults as res, i}
    {#if res.visible}
        <div 
            class="ocr-tooltip" 
            style="top: {res.y + res.h + 10}px; left: {res.x}px;"
        >
            {#if res.loading}
                <div class="loading">Processing...</div>
            {:else}
                <div class="original-text">{res.text}</div>
                <div class="divider"></div>
                <div class="translated-text">{res.translation}</div>
            {/if}
            <button class="close-tooltip" on:click={() => {
                const newResults = [...ocrResults];
                newResults.splice(i, 1);
                ocrResults = newResults;
                draw();
            }}>×</button>
        </div>
    {/if}
{/each}

<style>
    .main-canvas {
        display: block;
        width: 100%;
        height: 100%;
        background-color: #000;
        cursor: var(--cursor, default);
    }

    .ocr-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid var(--accent-color);
        border-radius: 8px;
        padding: 12px;
        color: white;
        max-width: 300px;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }

    .loading {
        color: var(--accent-color);
        font-size: 14px;
    }

    .original-text {
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        margin-bottom: 8px;
        max-height: 100px;
        overflow-y: auto;
    }

    .divider {
        height: 1px;
        background: rgba(255,255,255,0.2);
        margin: 8px 0;
    }

    .translated-text {
        font-size: 14px;
        color: white;
        font-weight: 500;
    }

    .close-tooltip {
        position: absolute;
        top: 4px;
        right: 4px;
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.5);
        cursor: pointer;
        padding: 4px;
    }

    .close-tooltip:hover {
        color: white;
    }
</style>
