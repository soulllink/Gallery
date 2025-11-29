<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import CanvasView from "./components/CanvasView.svelte";
    import OverlayControls from "./components/OverlayControls.svelte";
    import { handleDrop, handleTauriDrop } from "./lib/fileSystem";
    import { getCurrentWebview } from "@tauri-apps/api/webview";

    let isDragging = false;
    let unlisten: () => void;

    onMount(async () => {
        // Detect if running in Tauri
        if ("__TAURI_INTERNALS__" in window) {
            // Use the specific Webview DragDrop event listener
            unlisten = await getCurrentWebview().onDragDropEvent((event) => {
                if (event.payload.type === "over") {
                    isDragging = true;
                } else if (event.payload.type === "drop") {
                    isDragging = false;
                    // event.payload.paths is the array of strings we need
                    if (event.payload.paths && event.payload.paths.length > 0) {
                        handleTauriDrop(event.payload.paths);
                    }
                } else {
                    // type === 'cancel' or others
                    isDragging = false;
                }
            });
        }
    });

    onDestroy(() => {
        // Clean cleanup call without any stray text
        if (unlisten) unlisten();
    });

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function onDragLeave() {
        isDragging = false;
    }

    async function onDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer?.items) {
            await handleDrop(e.dataTransfer.items);
        }
    }
</script>

<div class="grid"></div>

<main
    on:dragover={onDragOver}
    on:dragleave={onDragLeave}
    on:drop={onDrop}
    class:dragging={isDragging}
>
    <CanvasView />
    <OverlayControls />

    {#if isDragging}
        <div class="drop-overlay">
            <div class="drop-message">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <h2>Drop files or folders here</h2>
                <p>Images and videos will be added to the gallery</p>
            </div>
        </div>
    {/if}
</main>

<style>
    .grid {
        height: 100vh;
        width: 100vw;
        background-image:
            linear-gradient(to right, #0f0f10 1px, transparent 1px),
            linear-gradient(to bottom, #0f0f10 1px, transparent 1px);
        background-size: 1rem 1rem;
        background-position: center center;
        position: fixed;
        top: 0;
        left: 0;
        z-index: -1;
        filter: blur(1px);
    }

    main {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background-color: transparent; /* Make transparent to show grid */
        color: #e0e0e0;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    }

    .drop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 15, 16, 0.95);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        pointer-events: none;
    }

    .drop-message {
        text-align: center;
        color: white;
        animation: fadeIn 0.2s ease;
    }

    .drop-message svg {
        margin-bottom: 20px;
        filter: drop-shadow(0 0 20px var(--accent-color));
    }

    .drop-message h2 {
        margin: 0 0 10px;
        font-size: 32px;
        background: var(--accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .drop-message p {
        margin: 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 16px;
    }

    main.dragging {
        border: 3px dashed var(--accent-color);
        box-sizing: border-box;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
