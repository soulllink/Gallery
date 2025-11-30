<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { FileItem } from '../stores';

    export let currentFile: FileItem | undefined;

    let progress = 0; // 0 to 100
    let duration = 0; // in seconds
    let currentTime = 0; // in seconds
    let isDragging = false;
    let progressBar: HTMLDivElement;

    // Helper to format seconds into MM:SS
    function formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function handleVideoUpdate(e: CustomEvent) {
        // Only update visuals from video if user isn't currently dragging the handle
        if (!isDragging && e.detail) {
            progress = e.detail.progress || 0;
            duration = e.detail.duration || 0;
            currentTime = (progress / 100) * duration;
        }
    }

    function calculateProgress(clientX: number) {
        if (!progressBar) return 0;
        const rect = progressBar.getBoundingClientRect();
        const x = clientX - rect.left;
        // Clamp between 0 and 1
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        return percentage;
    }

    function handleMouseDown(e: MouseEvent) {
        isDragging = true;
        const pct = calculateProgress(e.clientX);
        progress = pct * 100;
        currentTime = pct * duration;
    }

    function handleWindowMouseMove(e: MouseEvent) {
        if (!isDragging) return;

        const pct = calculateProgress(e.clientX);
        progress = pct * 100;
        currentTime = pct * duration;

        // Optional: Dispatch 'seeking' event if you want live preview while dragging
        // window.dispatchEvent(new CustomEvent('seekVideo', { detail: { percentage: pct, isScrubbing: true } }));
    }

    function handleWindowMouseUp(e: MouseEvent) {
        if (!isDragging) return;

        const pct = calculateProgress(e.clientX);
        isDragging = false;

        // Commit the seek
        window.dispatchEvent(new CustomEvent('seekVideo', { detail: { percentage: pct } }));
    }

    onMount(() => {
        window.addEventListener('videoUpdate', handleVideoUpdate as EventListener);
    });

    onDestroy(() => {
        window.removeEventListener('videoUpdate', handleVideoUpdate as EventListener);
    });
</script>

<svelte:window on:mousemove={handleWindowMouseMove} on:mouseup={handleWindowMouseUp} />

{#if currentFile?.type === 'video'}
    <div class="video-controls-container">
        <div class="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div
            class="progress-track"
            bind:this={progressBar}
            on:mousedown={handleMouseDown}
            role="slider"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            tabindex="0"
        >
            <div class="rail"></div>

            <div class="buffer"></div>

            <div class="fill" style="width: {progress}%"></div>

            <div class="handle" style="left: {progress}%"></div>
        </div>
    </div>
{/if}

<style>
    .video-controls-container {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 60%;
        max-width: 800px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        pointer-events: none; /* Let clicks pass through around the bar */
    }

    .time-display {
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.2s;
    }

    .video-controls-container:hover .time-display {
        opacity: 1;
    }

    .progress-track {
        position: relative;
        width: 100%;
        height: 20px; /* Hit area height */
        cursor: pointer;
        pointer-events: auto; /* Re-enable pointer for the bar */
        display: flex;
        align-items: center;
    }

    /* The visual lines */
    .rail, .buffer, .fill {
        position: absolute;
        height: 4px;
        border-radius: 2px;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
    }

    .rail {
        width: 100%;
        background: rgba(255, 255, 255, 0.2);
        transition: height 0.1s;
    }

    .fill {
        background: var(--accent-color, #3b82f6);
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    }

    .handle {
        position: absolute;
        top: 50%;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: 2;
        box-shadow: 0 0 4px rgba(0,0,0,0.3);
    }

    /* Hover States */
    .progress-track:hover .rail,
    .progress-track:hover .fill {
        height: 6px;
    }

    .progress-track:hover .handle,
    .progress-track:active .handle {
        transform: translate(-50%, -50%) scale(1);
    }
</style>