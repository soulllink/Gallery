<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { ViewSettings } from '../stores';

    export let settings: ViewSettings;
    export let isDirectVideoMode: boolean;
    export let videoElement: HTMLVideoElement;

    const dispatch = createEventDispatcher();

    function handleTimeUpdate() {
        dispatch('timeupdate');
    }

    function handlePlay() {
        dispatch('play');
    }

    function handlePause() {
        dispatch('pause');
    }
</script>

<!-- svelte-ignore a11y-media-has-caption -->
<video
    bind:this={videoElement}
    class="direct-video"
    class:visible={isDirectVideoMode}
    on:timeupdate={handleTimeUpdate}
    on:play={handlePlay}
    on:pause={handlePause}
    style="
        width: {settings.viewMode === 'fit-h' ? '100%' : 'auto'};
        height: {settings.viewMode === 'fit-v' ? '100%' : 'auto'};
        max-width: {settings.viewMode === 'original' ? 'none' : '100%'};
        max-height: {settings.viewMode === 'original' ? 'none' : '100%'};
        transform: scale({settings.zoom});
        filter: {isDirectVideoMode ? `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)` : 'none'};
    "
></video>

<style>
    .direct-video {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: none; /* Hidden by default */
        z-index: 1; /* Below UI but above canvas background if needed */
        pointer-events: none; /* Let clicks pass through to canvas for gestures */
    }
    
    .direct-video.visible {
        display: block;
    }
</style>
