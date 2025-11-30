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
    import { performOCR, handleAutoOCR, type OCRResultItem } from '../lib/Canvas/OCRHandler';

    // ... (Keep existing state variables: canvas, image, video, panX, panY, etc.)
    let canvas: HTMLCanvasElement;
    let canvasRenderer: CanvasRenderer;
    let image: HTMLImageElement | null = null;
    let video: HTMLVideoElement | null = null;
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
        video.volume = Math.min(settings.volume / 100, 6);
        canvasRenderer?.draw();
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
        const result = await mediaManager.loadFile(item, video, settings);
        image = result.image;
        video = result.video;
        currentUrl = result.currentUrl;
        scrollOffset = 0;
        panX = 0;
        panY = 0;
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
            { image, video },
            getTransformParams(),
            ocrResults
        );
        canvasRenderer?.draw();
    }

    async function onAutoOCR() {
        const newResults = await handleAutoOCR({ image, video }, settings.targetLanguage || "English");
        ocrResults = [...ocrResults, ...newResults];
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
            const dx = e.clientX - lastPointerX;
            const dy = e.clientY - lastPointerY;
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
                     executeAction(deltaX > 0 ? 'nextFile' : 'prevFile');
                }
            }
            isRightClickDown = false;
        } else if (isPointerDown) {
            const totalDx = panX - panStartX;
            const totalDy = panY - panStartY;
            if (Math.abs(totalDx) > 1 || Math.abs(totalDy) > 1) {
                recordAction({ type: 'pan', value: { x: totalDx, y: totalDy } });
            }
            isPointerDown = false;
        }
    }

    // ... (Keep remaining functions: handleContextMenu, handleWheel, startAutoScroll, executeAction, recordAction, handleKeydown, playMacro, handleResize, handleSeekVideo, handleMacroPlay)

    function handleContextMenu(e: MouseEvent) {
        if (blockContextMenu) {
            e.preventDefault();
            blockContextMenu = false;
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.001;
        const newZoom = Math.max(0.1, Math.min(5, settings.zoom + zoomDelta));
        viewSettings.update(v => ({ ...v, zoom: newZoom }));
        if ($isRecording) recordAction({ type: 'zoom', value: zoomDelta });
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
        if ($isRecording) recordedActions.update(actions => [...actions, { ...action, timestamp: Date.now() }]);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'r' || e.key === 'R') {
            viewSettings.update(s => ({ ...s, rotation: (s.rotation + 90) % 360 }));
            return;
        }
        const macroSlot = $macroSlots.find(slot => slot.keyBinding && slot.keyBinding === e.key && slot.actions.length > 0);
        if (macroSlot) { e.preventDefault(); playMacro(macroSlot.actions); return; }
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

    function playMacro(actions: MacroAction[]) {
        let actionIndex = 0;
        function executeNext() {
            if (actionIndex >= actions.length) return;
            const action = actions[actionIndex];
            actionIndex++;
            switch (action.type) {
                case 'navigate':
                    if (action.value > 0) currentFileIndex.update(i => Math.min(i + action.value, $files.length - 1));
                    else currentFileIndex.update(i => Math.max(i + action.value, 0));
                    break;
                case 'pan': panX += action.value.x || 0; panY += action.value.y || 0; canvasRenderer?.draw(); break;
                case 'viewMode': viewSettings.update(v => ({ ...v, viewMode: action.value, zoom: (action.value === 'fit-h' || action.value === 'fit-v') ? 1 : v.zoom })); break;
                case 'zoom': viewSettings.update(v => ({ ...v, zoom: Math.max(0.1, Math.min(5, v.zoom + action.value)) })); canvasRenderer?.draw(); break;
                case 'rotation': viewSettings.update(v => ({ ...v, rotation: action.value })); break;
                case 'wait': setTimeout(executeNext, action.value || 0); return;
            }
            setTimeout(executeNext, 10);
        }
        executeNext();
    }

    function handleResize() { canvasRenderer?.draw(); }
    function handleSeekVideo(e: CustomEvent) { if (video && e.detail.percentage !== undefined) { video.currentTime = e.detail.percentage * video.duration; canvasRenderer?.draw(); } }
    function handleMacroPlay(e: CustomEvent) { playMacro(e.detail); }

    onMount(() => {
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('triggerAutoOCR', onAutoOCR);
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('playMacro', handleMacroPlay as EventListener);
        window.addEventListener('seekVideo', handleSeekVideo as EventListener);
    });

    onDestroy(() => {
        stopAutoScroll();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('triggerAutoOCR', onAutoOCR);
        window.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('playMacro', handleMacroPlay as EventListener);
        window.removeEventListener('seekVideo', handleSeekVideo as EventListener);
        if (videoFrame) cancelAnimationFrame(videoFrame);
        if (currentUrl) URL.revokeObjectURL(currentUrl);
    });
</script>

<CanvasRenderer
    bind:this={canvasRenderer}
    bind:canvas={canvas}
    {image} {video} {settings}
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