<script lang="ts">
    // ... (Keep existing imports)
    import { onMount, onDestroy } from 'svelte';
    import { files, currentFileIndex, viewSettings, keybindings, isRecording, recordedActions, macroSlots, isOCRMode, isUIVisible } from '../stores';
    import { imageToScreenCoords, getEdgePosition, type TransformParams } from '../lib/CoordinateTransforms';
    import type { FileItem, MacroAction } from '../stores';
    import CanvasRenderer from './CanvasRenderer.svelte';
    import OCRPanel from './OCRPanel.svelte';

    // Import Logic Helpers
    import { MediaManager } from '../lib/Canvas/MediaManager';
    import { dbService } from '../lib/DatabaseService';
    import { performOCR, type OCRResultItem } from '../lib/Canvas/OCRHandler';

    // ... (Keep existing state variables: canvas, image, video, panX, panY, etc.)
    let canvas: HTMLCanvasElement;
    let canvasRenderer: CanvasRenderer;
    let image: HTMLImageElement | null = null;
    let video: HTMLVideoElement | null = null;
    let isGif: boolean = false;
    let currentUrl: string | null = null;
    let videoFrame: number | null = null;
    let scrollOffset = 0;
    let panX = 0;
    let panY = 0;
    let isScrolling = false;
    let scrollFrame: number | null = null;
    let lastTimestamp = 0;
    const PAN_SPEED = 20;

    let isPointerDown = false;
    let lastPointerX = 0, lastPointerY = 0;
    let panStartX = 0, panStartY = 0;
    let isRightClickDown = false;
    let gestureStartX = 0, gestureStartY = 0;
    let blockContextMenu = false;
    let resizeTimeout: number;

    let selectionStart: { x: number, y: number } | null = null;
    let selectionEnd: { x: number, y: number } | null = null;
    let ocrResults: OCRResultItem[] = [];

    // ... (Keep helpers: mediaManager, reactive statements, loadFileItem, getTransformParams, etc.)
    const mediaManager = new MediaManager(
        () => canvasRenderer?.draw(),
        (id) => videoFrame = id
    );

    $: fileItem = $files[$currentFileIndex];
    $: settings = $viewSettings;

    $: if (settings && video) {
        video.playbackRate = settings.videoSpeed;
        mediaManager.updateVolume(settings.volume);
    }
    
    // Reactive redraw whenever settings, image, or video changes
    $: if (canvasRenderer && (settings || image || video)) {
        canvasRenderer.draw();
    }

    $: if (fileItem) loadFileItem(fileItem);

    $: tooltipResults = ocrResults.map(res => {
        if (!image && !video) return res;
        const params = getTransformParams();
        const screenCoords = imageToScreenCoords(res.x, res.y, res.w, res.h, params);
        return {
            ...res,
            x: screenCoords.x,
            y: screenCoords.y,
            w: screenCoords.w,
            h: screenCoords.h
        };
    });

    async function loadFileItem(item: FileItem) {
        stopAutoScroll();
        if (videoFrame) cancelAnimationFrame(videoFrame);
        ocrResults = []; // Clear previous OCR results

        const result = await mediaManager.loadFile(item, video, settings);
        image = result.image;
        video = result.video;
        isGif = result.isGif;
        currentUrl = result.currentUrl;
        scrollOffset = 0;
        panX = 0;
        panY = 0;
        
        // Load Translations from DB AFTER media is loaded
        try {
            const cached = await dbService.getTranslationsForFile(item.path);
            if (cached && cached.length > 0) {
                ocrResults = cached.map(c => ({
                    text: c.text,
                    translation: c.translated_text,
                    x: c.x,
                    y: c.y,
                    w: c.w,
                    h: c.h,
                    visible: true,
                    loading: false,
                    dbId: c.id
                }));
            }
        } catch (e) {
            console.error("Failed to load translations", e);
        }

        if (settings.viewMode === 'reader' && item.type === 'image') {
            startAutoScroll();
        }
    }

    function getTransformParams(): TransformParams {
        return {
            mediaW: image ? image.width : (video ? video.videoWidth : 0),
            mediaH: image ? image.height : (video ? video.videoHeight : 0),
            settings, panX, panY, scrollOffset,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            canvas
        };
    }

    async function onPerformOCR(x: number, y: number, w: number, h: number) {
        ocrResults = await performOCR(
            { x, y, w, h },
            { image, video, currentFilePath: fileItem?.path },
            getTransformParams(),
            ocrResults
        );
        canvasRenderer?.draw();
    }

    // --- UPDATED POINTER HANDLERS ---

    function handlePointerDown(e: PointerEvent) {
        canvas.setPointerCapture(e.pointerId);

        // Check for OCR Mode OR Shift Key
        if ($isOCRMode || e.shiftKey) {
            selectionStart = { x: e.clientX, y: e.clientY };
            selectionEnd = { x: e.clientX, y: e.clientY };
            // Optional: Clear previous results on new selection?
            // ocrResults = [];
        } else if (e.button === 2) {
            isRightClickDown = true;
            gestureStartX = e.clientX;
            gestureStartY = e.clientY;
            blockContextMenu = false;
        } else {
            isPointerDown = true;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            panStartX = panX;
            panStartY = panY;
        }
    }

    function handlePointerMove(e: PointerEvent) {
        // If a selection started, continue updating it regardless of key state
        if (selectionStart) {
            selectionEnd = { x: e.clientX, y: e.clientY };
            canvasRenderer?.draw();
        } else if (isPointerDown && !isRightClickDown) {
            const dx = (e.clientX - lastPointerX) * settings.panSensitivity;
            const dy = (e.clientY - lastPointerY) * settings.panSensitivity;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            panX += dx;
            panY += dy;
            canvasRenderer?.draw();
        }
    }

    function handlePointerUp(e: PointerEvent) {
        canvas.releasePointerCapture(e.pointerId);

        if (selectionStart && selectionEnd) {
            const startX = Math.min(selectionStart.x, selectionEnd.x);
            const startY = Math.min(selectionStart.y, selectionEnd.y);
            const w = Math.abs(selectionEnd.x - selectionStart.x);
            const h = Math.abs(selectionEnd.y - selectionStart.y);

            selectionStart = null;
            selectionEnd = null;
            canvasRenderer?.draw();

            // Only trigger OCR if the box is big enough (avoid accidental clicks)
            if (w > 10 && h > 10) {
                onPerformOCR(startX, startY, w, h);
            }
        } else {
            handleGestureOrPanEnd(e);
        }
    }

    function handleGestureOrPanEnd(e: PointerEvent) {
        // ... (Keep existing gesture/pan end logic)
        if (isRightClickDown && e.button === 2) {
            const deltaX = e.clientX - gestureStartX;
            const deltaY = e.clientY - gestureStartY;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (dist > 50) {
                blockContextMenu = true;
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                     // Inverted: Drag Left (deltaX < 0) -> Next, Drag Right (deltaX > 0) -> Prev
                     executeAction(deltaX > 0 ? 'prevFile' : 'nextFile');
                }
            }
            isRightClickDown = false;
        } else if (isPointerDown) {
            const totalDx = panX - panStartX;
            const totalDy = panY - panStartY;
            if (Math.abs(totalDx) > 1 || Math.abs(totalDy) > 1) {
                const params = getTransformParams();
                const w = params.mediaW || 1;
                const h = params.mediaH || 1;
                
                // Axis Locking to prevent drift
                let rx = totalDx;
                let ry = totalDy;
                
                if (Math.abs(totalDx) > Math.abs(totalDy) * 3) ry = 0;
                else if (Math.abs(totalDy) > Math.abs(totalDx) * 3) rx = 0;

                // Record relative to image dimensions at current zoom
                recordAction({ 
                    type: 'pan', 
                    value: { 
                        x: rx / (w * settings.zoom), 
                        y: ry / (h * settings.zoom) 
                    },
                    relative: true
                });
            }
            isPointerDown = false;
        }
    }

    // ... (Keep remaining functions: handleContextMenu, handleWheel, startAutoScroll, executeAction, recordAction, handleKeydown, playMacro, handleResize, handleSeekVideo, handleMacroPlay)

    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    function handleContextMenu(e: MouseEvent) {
        if (blockContextMenu) {
            e.preventDefault();
            blockContextMenu = false;
            return;
        }
        e.preventDefault();
        dispatch('contextmenu', { x: e.clientX, y: e.clientY });
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.001 * settings.zoomSensitivity;
        const newZoom = Math.max(0.1, Math.min(5, settings.zoom + zoomDelta));
        const multiplier = newZoom / settings.zoom;
        viewSettings.update(v => ({ ...v, zoom: newZoom }));
        if ($isRecording) recordAction({ type: 'zoom', value: multiplier, relative: true });
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => canvasRenderer?.draw(), 100);
    }

    function startAutoScroll() {
        stopAutoScroll();
        isScrolling = true;
        lastTimestamp = performance.now();
        scrollFrame = requestAnimationFrame(stepAutoScroll);
    }

    function stopAutoScroll() {
        isScrolling = false;
        if (scrollFrame) { cancelAnimationFrame(scrollFrame); scrollFrame = null; }
    }

    function stepAutoScroll(timestamp: number) {
        if (!isScrolling) return;
        const delta = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        scrollOffset += (30 * delta) / 1000;
        canvasRenderer?.draw();
        scrollFrame = requestAnimationFrame(stepAutoScroll);
    }

    function executeAction(action: string) {
        const params = getTransformParams();
        switch (action) {
            case 'nextFile':
                currentFileIndex.update(i => Math.min(i + 1, $files.length - 1));
                recordAction({ type: 'navigate', value: 1 });
                break;
            case 'prevFile':
                currentFileIndex.update(i => Math.max(i - 1, 0));
                recordAction({ type: 'navigate', value: -1 });
                break;
            case 'toggleUI': isUIVisible.update(v => !v); break;
            case 'pauseScroll':
                if (video) video.paused ? video.play() : video.pause();
                else isScrolling ? stopAutoScroll() : startAutoScroll();
                break;
            case 'stopScroll': stopAutoScroll(); break;
            case 'firstFile': currentFileIndex.set(0); break;
            case 'lastFile': currentFileIndex.set($files.length - 1); break;
            case 'panUp':
                if (settings.shift) panY = getEdgePosition('top', params);
                else panY += PAN_SPEED;
                canvasRenderer?.draw();
                break;
            case 'panDown':
                if (settings.shift) panY = getEdgePosition('bottom', params);
                else panY -= PAN_SPEED;
                canvasRenderer?.draw();
                break;
            case 'panLeft':
                if (settings.shift) panX = getEdgePosition('left', params);
                else panX += PAN_SPEED;
                canvasRenderer?.draw();
                break;
            case 'panRight':
                if (settings.shift) panX = getEdgePosition('right', params);
                else panX -= PAN_SPEED;
                canvasRenderer?.draw();
                break;
        }
    }

    function recordAction(action: MacroAction) {
        if ($isRecording) {
            recordedActions.update(actions => {
                const now = Date.now();
                const lastAction = actions[actions.length - 1];
                if (lastAction && lastAction.timestamp) {
                    const diff = now - lastAction.timestamp;
                    if (diff > 0) {
                        // Round up to nearest 100ms (0.1s)
                        const delay = Math.ceil(diff / 100) * 100;
                        if (delay > 0) {
                             actions.push({ type: 'wait', value: delay, timestamp: now });
                        }
                    }
                }
                return [...actions, { ...action, timestamp: now }];
            });
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
             if (isMacroPlaying) {
                 stopMacroFlag = true;
                 return;
             }
             // Existing Shift logic
             // ...
        }

        if (e.key === 'r' || e.key === 'R') {
            viewSettings.update(s => ({ ...s, rotation: (s.rotation + 90) % 360 }));
            return;
        }
        const macroSlot = $macroSlots.find(slot => slot.keyBinding && slot.keyBinding === e.key && slot.actions.length > 0);
        if (macroSlot) { 
            e.preventDefault(); 
            // If already playing this macro (or any macro), stop it?
            // For now, if playing, stop. If not, play.
            if (isMacroPlaying) {
                stopMacroFlag = true;
            } else {
                playMacro(macroSlot.actions, macroSlot.loop); 
            }
            return; 
        }
        if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
        if (e.target instanceof HTMLTextAreaElement) return;
        if (e.shiftKey !== settings.shift) viewSettings.update(s => ({ ...s, shift: e.shiftKey }));

        const isPanKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
        const binding = $keybindings.find(b => {
            if (isPanKey) return b.key === e.key && !!b.ctrl === e.ctrlKey && !!b.alt === e.altKey;
            return b.key === e.key && !!b.ctrl === e.ctrlKey && !!b.shift === e.shiftKey && !!b.alt === e.altKey;
        });
        if (binding) { e.preventDefault(); executeAction(binding.action); }
    }

    let isMacroPlaying = false;
    let stopMacroFlag = false;

    async function playMacro(actions: MacroAction[], loop: boolean = false) {
        if (isMacroPlaying) {
             stopMacroFlag = true;
             return;
        }

        isMacroPlaying = true;
        stopMacroFlag = false;

        async function runSequence() {
            let actionIndex = 0;
            
            // Helper to execute with delay
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            while (actionIndex < actions.length) {
                if (stopMacroFlag) break;

                const action = actions[actionIndex];
                actionIndex++;

                switch (action.type) {
                    case 'navigate':
                        if (action.value > 0) currentFileIndex.update(i => Math.min(i + action.value, $files.length - 1));
                        else currentFileIndex.update(i => Math.max(i + action.value, 0));
                        break;
                    case 'zoom': 
                        if (action.relative) {
                            viewSettings.update(v => ({ ...v, zoom: Math.max(0.1, Math.min(5, v.zoom * action.value)) }));
                        } else {
                            viewSettings.update(v => ({ ...v, zoom: Math.max(0.1, Math.min(5, v.zoom + action.value)) })); 
                        }
                        canvasRenderer?.draw(); 
                        break;
                    case 'pan':
                         if (action.relative) {
                             const params = getTransformParams();
                             const w = params.mediaW || 1;
                             const h = params.mediaH || 1;
                             // dx = relX * w * zoom
                             panX += action.value.x * w * settings.zoom;
                             panY += action.value.y * h * settings.zoom;
                         } else {
                             panX += action.value.x; 
                             panY += action.value.y; 
                         }
                         canvasRenderer?.draw(); 
                         break;
                    case 'rotation': viewSettings.update(v => ({ ...v, rotation: action.value })); break;
                    case 'wait': 
                        await delay(action.value || 0);
                        break;
                }
                // Small delay between actions to prevent UI freeze if no wait actions
                await delay(10);
            }

            if (loop && !stopMacroFlag) {
                // Check if user pressed any key to stop (handled via event listener elsewhere, but here we check flag)
                // Recursive call effectively
                await runSequence();
            }
        }

        await runSequence();
        isMacroPlaying = false;
        stopMacroFlag = false;
    }

    function handleResize() { canvasRenderer?.draw(); }
    function handleSeekVideo(e: CustomEvent) { if (video && e.detail.percentage !== undefined) { video.currentTime = e.detail.percentage * video.duration; canvasRenderer?.draw(); } }
    function handleMacroPlay(e: CustomEvent) { 
        if (e.detail.actions) {
             playMacro(e.detail.actions, e.detail.loop); 
        } else {
             // Fallback for old events or direct action array
             playMacro(e.detail);
        }
    }

    onMount(() => {
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('playMacro', handleMacroPlay as EventListener);
        window.addEventListener('seekVideo', handleSeekVideo as EventListener);
    });

    onDestroy(() => {
        stopAutoScroll();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('playMacro', handleMacroPlay as EventListener);
        window.removeEventListener('seekVideo', handleSeekVideo as EventListener);
        if (videoFrame) cancelAnimationFrame(videoFrame);
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        mediaManager.cleanupAudio();
    });
</script>

<CanvasRenderer
    bind:this={canvasRenderer}
    bind:canvas={canvas}
    {image} {video} {isGif} {settings}
    {panX} {panY} {scrollOffset}
    isOCRMode={$isOCRMode}
    {selectionStart} {selectionEnd}
    {ocrResults}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
    on:wheel={handleWheel}
/>

<OCRPanel
    ocrResults={tooltipResults}
    onClose={(idx) => {
        const newResults = [...ocrResults];
        newResults.splice(idx, 1);
        ocrResults = newResults;
        canvasRenderer?.draw();
    }}
/>