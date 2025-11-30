<script lang="ts">
    export let ocrResults: Array<{
        text: string;
        translation: string;
        x: number;
        y: number;
        w: number;
        h: number;
        visible: boolean;
        loading: boolean;
        isFallback?: boolean; // Ensure this prop is defined
    }> = [];
export let onClose: (index: number) => void;
</script>

{#each ocrResults as res, i}
    {#if res.visible}
        <div
            class="ocr-tooltip"
            class:fallback={res.isFallback}
            style={res.isFallback ? '' : `top: ${res.y + res.h + 10}px; left: ${res.x}px;`}
>
            {#if res.loading}
                <div class="loading">Processing...</div>
            {:else}
                <div class="original-text">{res.text}</div>
                <div class="divider"></div>
                <div class="translated-text">{res.translation}</div>
     {/if}
            <button class="close-tooltip" on:click={() => onClose(i)}>×</button>
        </div>
    {/if}
{/each}

<style>
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

    /* --- FIXED: Fallback Positioning --- */
    .ocr-tooltip.fallback {
        /* Reset any inherited top/left logic */
        top: auto !important;
        left: 50% !important;
        transform: translateX(-50%);

        /* Position higher than bottom controls (approx 160px from bottom) */
        bottom: 160px;

        /* Make it look like a subtitle banner */
        width: auto;
        min-width: 300px;
        max-width: 80vw;
        text-align: center;

        /* High Z-Index to stay above video controls */
        z-index: 2000;

        /* Visual distinction */
        border-color: #ff9800;
        background: rgba(10, 10, 10, 0.95);
    }

    .ocr-tooltip.fallback .original-text {
        max-height: 60px; /* Limit height for subtitles */
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