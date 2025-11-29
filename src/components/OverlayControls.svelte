<script lang="ts">
    import { openDirectory } from '../lib/fileSystem';
    import { viewSettings, gotoFile, files, currentFileIndex, isLoading, isUIVisible, isSettingsOpen, isOCRMode } from '../stores';
    import SearchWidget from './SearchWidget.svelte';
    import SettingsModal from './SettingsModal.svelte';
    import MacroRecorder from './MacroRecorder.svelte';

    function handleOpen() {
        openDirectory();
    }

    function setViewMode(mode: 'original' | 'fit-h' | 'fit-v' | 'reader' | 'landscape') {
        viewSettings.update(v => ({ 
            ...v, 
            viewMode: mode,
            zoom: (mode === 'fit-h' || mode === 'fit-v') ? 1 : v.zoom 
        }));
    }

    let gotoInput = '';
    function handleGoto() {
        const idx = parseInt(gotoInput, 10) - 1;
        if (!isNaN(idx)) {
            gotoFile(idx);
        }
        gotoInput = '';
    }

    function toggleUI() {
        isUIVisible.update(v => !v);
    }

    function openSettings() {
        isSettingsOpen.set(true);
    }

    $: currentFile = $files[$currentFileIndex];
    $: fileCounter = $files.length > 0 ? `${$currentFileIndex + 1} / ${$files.length}` : '';
</script>

<SettingsModal />

{#if $isUIVisible}
    <div class="overlay-container">
        <!-- Top Bar -->
        <div class="top-bar glass-panel">
            <button class="icon-btn" on:click={handleOpen} title="Open Folder">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </button>
            
            {#if $isLoading}
                <div class="loading-spinner"></div>
            {/if}
            
            <div class="spacer"></div>
            
            <!-- View Mode Buttons -->
            <div class="view-mode-buttons">
                <button 
                    class="mode-btn {$viewSettings.viewMode === 'original' ? 'active' : ''}"
                    on:click={() => setViewMode('original')}
                    title="Original Size"
                >1:1</button>
                <button 
                    class="mode-btn {$viewSettings.viewMode === 'fit-h' ? 'active' : ''}"
                    on:click={() => setViewMode('fit-h')}
                    title="Fit Horizontal"
                >↔</button>
                <button 
                    class="mode-btn {$viewSettings.viewMode === 'fit-v' ? 'active' : ''}"
                    on:click={() => setViewMode('fit-v')}
                    title="Fit Vertical"
                >↕</button>
                <button 
                    class="mode-btn {$viewSettings.viewMode === 'reader' ? 'active' : ''}"
                    on:click={() => setViewMode('reader')}
                    title="Reader Mode"
                >B</button>
                <button 
                    class="mode-btn {$viewSettings.viewMode === 'landscape' ? 'active' : ''}"
                    on:click={() => setViewMode('landscape')}
                    title="Landscape Scroll"
                >L</button>
            </div>

            <div class="spacer"></div>
            
            <SearchWidget />
            <input type="number" min="1" placeholder="Go to #" bind:value={gotoInput} class="goto-input" on:keydown={(e) => e.key === 'Enter' && handleGoto()} />
            <button class="icon-btn" on:click={handleGoto} title="Go To">Go</button>
            
            <!-- Macro Recorder -->
            <MacroRecorder />
            
            <!-- OCR Toggle -->
            <button 
                class="icon-btn {$isOCRMode ? 'active' : ''}" 
                on:click={(e) => {
                    if (e.shiftKey) {
                        isOCRMode.update(v => !v);
                    } else {
                        // Trigger Auto OCR
                        window.dispatchEvent(new CustomEvent('triggerAutoOCR'));
                    }
                }} 
                title="OCR / Translate (Click: Auto, Shift+Click: Manual)"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>

            <!-- Settings Cog -->
            <button class="icon-btn" on:click={openSettings} title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
            
            <!-- Hide UI Button -->
            <button class="icon-btn" on:click={toggleUI} title="Hide UI (H)">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
        </div>

        <!-- File Info Overlay -->
        {#if currentFile}
            <div class="file-info">
                <div class="file-name">{currentFile.name}</div>
                <div class="file-counter">{fileCounter}</div>
            </div>
        {/if}

        <div class="bottom-controls glass-panel">
            <div class="slider-group">
                <span class="value">{$viewSettings.brightness}%</span>
                <label>
                    <input type="range" min="0" max="200" bind:value={$viewSettings.brightness} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </label>
            </div>
            <div class="slider-group">
                <span class="value">{$viewSettings.contrast}%</span>
                <label>
                    <input type="range" min="0" max="200" bind:value={$viewSettings.contrast} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M2 12h20"></path>
                    </svg>
                </label>
            </div>
            <div class="slider-group">
                <span class="value">{$viewSettings.saturation}%</span>
                <label>
                    <input type="range" min="0" max="200" bind:value={$viewSettings.saturation} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                    </svg>
                </label>
            </div>
            <div class="slider-group">
                <span class="value">{$viewSettings.hue}°</span>
                <label>
                    <input type="range" min="0" max="360" bind:value={$viewSettings.hue} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                    </svg>
                </label>
            </div>
            <div class="slider-group">
                <span class="value">{$viewSettings.videoSpeed}x</span>
                <label>
                    <input type="range" min="0.25" max="4" step="0.25" bind:value={$viewSettings.videoSpeed} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </label>
            </div>
            <div class="slider-group">
                <span class="value">{$viewSettings.volume}%</span>
                <label>
                    <input type="range" min="0" max="600" bind:value={$viewSettings.volume} />
                    <svg class="volume" xmlns="http://www.w3.org/2000/svg" version="1.1" width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.36 19.36a1 1 0 0 1-.705-1.71C19.167 16.148 20 14.142 20 12s-.833-4.148-2.345-5.65a1 1 0 1 1 1.41-1.419C20.958 6.812 22 9.322 22 12s-1.042 5.188-2.935 7.069a.997.997 0 0 1-.705.291z"></path>
                        <path d="M15.53 16.53a.999.999 0 0 1-.703-1.711C15.572 14.082 16 13.054 16 12s-.428-2.082-1.173-2.819a1 1 0 1 1 1.406-1.422A6 6 0 0 1 18 12a6 6 0 0 1-1.767 4.241.996.996 0 0 1-.703.289zM12 22a1 1 0 0 1-.707-.293L6.586 17H4c-1.103 0-2-.897-2-2V9c0-1.103.897-2 2-2h2.586l4.707-4.707A.998.998 0 0 1 13 3v18a1 1 0 0 1-1 1z"></path>
                    </svg>
                </label>
            </div>
        </div>

        <div class="shortcuts-hint">
            <kbd>PgUp/PgDn</kbd> Navigate • <kbd>Arrows</kbd> Pan • <kbd>R</kbd> Rotate • <kbd>H</kbd> Hide UI
        </div>
    </div>
{:else}
    <!-- UI Hidden - Show small toggle button -->
    <button class="show-ui-btn" on:click={toggleUI} title="Show UI (H)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
    </button>
{/if}

<style>
    .overlay-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 20px;
        box-sizing: border-box;
    }
    
    .glass-panel {
        pointer-events: auto;
        padding: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
    }
    
    .top-bar {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        justify-content: flex-start;
        flex-wrap: wrap;
    }
    
    .spacer {
        flex: 0.5;
    }
    
    .bottom-controls {
        width: auto;
        max-width: 95%;
        margin: 0 auto 20px;
        display: flex;
        flex-direction: row;
        gap: 15px;
        justify-content: center;
        align-items: center;
        padding: 10px 20px;
        flex-wrap: wrap;
    }
    
    .slider-group {
        display: flex;
        flex-direction: row-reverse;
        align-items: center;
        gap: 5px;
    }
    
    .slider-group label {
        cursor: pointer;
        display: inline-flex;
        flex-direction: row-reverse;
        align-items: center;
        font-size: 12px;
        color: rgba(255,255,255,0.7);
    }
    
    .slider-group .value {
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        min-width: 45px;
        text-align: right;
        margin-right: 15px;
    }
    
    input[type="range"] {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        width: 150px;
        height: 6px;
        background: rgb(82, 82, 82);
        overflow: hidden;
        border-radius: 999px;
        transition: height 0.1s;
        cursor: pointer;
        margin-left: 10px;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 0;
        height: 0;
        box-shadow: -200px 0 0 200px #fff;
    }

    input[type="range"]::-moz-range-thumb {
        width: 0;
        height: 0;
        box-shadow: -200px 0 0 200px #fff;
        border: none;
    }

    .slider-group:hover input[type="range"] {
        height: 12px;
    }

    .slider-group .volume {
        display: inline-block;
        vertical-align: middle;
        color: rgb(82, 82, 82);
        width: 25px;
        height: 25px;
    }
    
    .icon-btn {
        background: transparent;
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
    }
    
    .icon-btn:hover {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.2);
    }
    
    .view-mode-buttons {
        display: flex;
        gap: 5px;
        background: rgba(0, 0, 0, 0.3);
        padding: 4px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.1);
    }
    
    .mode-btn {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.6);
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s;
        font-size: 16px;
        min-width: 36px;
    }
    
    .mode-btn:hover {
        background: rgba(255,255,255,0.1);
        color: white;
    }
    
    .mode-btn.active {
        background: var(--accent-gradient);
        color: white;
    }
    
    .goto-input {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        width: 80px;
        outline: none;
        text-align: center;
    }
    
    .goto-input:focus {
        border-color: var(--accent-color);
    }
    
    .file-info {
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        text-align: center;
        animation: fadeIn 0.3s ease;
    }
    
    .file-name {
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(10px);
        color: white;
        padding: 8px 20px;
        border-radius: 20px;
        font-size: 14px;
        margin-bottom: 5px;
    }
    
    .file-counter {
        color: rgba(255,255,255,0.7);
        font-size: 12px;
        font-weight: 600;
    }
    
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: var(--accent-color);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    .shortcuts-hint {
        position: absolute;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(10px);
        padding: 8px 16px;
        border-radius: 20px;
        color: rgba(255,255,255,0.6);
        font-size: 12px;
        pointer-events: none;
    }
    
    .show-ui-btn {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        color: white;
        padding: 12px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .show-ui-btn:hover {
        background: rgba(0,0,0,0.9);
        border-color: var(--accent-color);
    }
    
    kbd {
        background: rgba(255,255,255,0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
</style>
