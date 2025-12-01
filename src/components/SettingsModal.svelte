<script lang="ts">
    import { isSettingsOpen, keybindings, macroSlots, ollamaSettings, viewSettings } from '../stores';
    import type { KeyBinding } from '../stores';

    let editingIndex = -1;
    let editingMacroIndex = -1;
    let captureMode = false;

    function handleKeyCapture(e: KeyboardEvent, index: number) {
        if (!captureMode) return;
        e.preventDefault();
        
        const key = e.key;
        
        if (editingIndex >= 0) {
            keybindings.update(bindings => {
                bindings[index] = {
                    ...bindings[index],
                    key,
                    ctrl: e.ctrlKey,
                    shift: e.shiftKey,
                    alt: e.altKey
                };
                return bindings;
            });
            editingIndex = -1;
        } else if (editingMacroIndex >= 0) {
             macroSlots.update(slots => {
                slots[editingMacroIndex].keyBinding = key;
                return slots;
            });
            editingMacroIndex = -1;
        }
        
        captureMode = false;
    }

    function startCapture(index: number) {
        editingIndex = index;
        editingMacroIndex = -1;
        captureMode = true;
    }

    function startMacroCapture(index: number) {
        editingMacroIndex = index;
        editingIndex = -1;
        captureMode = true;
    }

    function closeSettings() {
        isSettingsOpen.set(false);
    }

    function formatKey(binding: KeyBinding): string {
        const parts = [];
        if (binding.ctrl) parts.push('Ctrl');
        if (binding.shift) parts.push('Shift');
        if (binding.alt) parts.push('Alt');
        parts.push(binding.key);
        return parts.join('+');
    }

    function resetToDefaults() {
        keybindings.set([
            { action: 'nextFile', key: 'PageDown' },
            { action: 'prevFile', key: 'PageUp' },
            { action: 'panUp', key: 'ArrowUp' },
            { action: 'panDown', key: 'ArrowDown' },
            { action: 'panLeft', key: 'ArrowLeft' },
            { action: 'panRight', key: 'ArrowRight' },
            { action: 'toggleUI', key: 'h' },
            { action: 'firstFile', key: 'Home' },
            { action: 'lastFile', key: 'End' },
            { action: 'pauseScroll', key: ' ' },
            { action: 'stopScroll', key: 'Escape' },
        ]);
    }

    let availableModels: string[] = [];
    let isFetchingModels = false;
    let fetchError = '';

    async function fetchModels() {
        isFetchingModels = true;
        fetchError = '';
        try {
            const response = await fetch(`${$ollamaSettings.url}/api/tags`);
            if (!response.ok) throw new Error('Failed to fetch models');
            const data = await response.json();
            availableModels = data.models.map((m: any) => m.name);
            if (availableModels.length > 0 && !$ollamaSettings.model) {
                $ollamaSettings.model = availableModels[0];
            }
        } catch (e) {
            console.error(e);
            fetchError = 'Failed to fetch models. Ensure Ollama is running.';
        } finally {
            isFetchingModels = false;
        }
    }

    const ocrLanguages = [
        { code: 'eng', name: 'English' },
        { code: 'jpn', name: 'Japanese' },
        { code: 'chi_sim', name: 'Chinese (Simplified)' },
        { code: 'chi_tra', name: 'Chinese (Traditional)' },
        { code: 'kor', name: 'Korean' },
    ];
</script>

<svelte:window on:keydown={(e) => (editingIndex >= 0 || editingMacroIndex >= 0) && handleKeyCapture(e, editingIndex >= 0 ? editingIndex : editingMacroIndex)} />

{#if $isSettingsOpen}
    <div class="settings-overlay" on:click={closeSettings}>
        <div class="settings-modal glass-panel" on:click|stopPropagation>
            <div class="settings-header">
                <h2>Settings</h2>
                <button class="close-btn" on:click={closeSettings}>✕</button>
            </div>

            <div class="settings-content">
                <section>
                    <h3>Keybindings</h3>
                    <div class="keybindings-list">
                        {#each $keybindings as binding, i}
                            <div class="keybinding-row">
                                <span class="action-name">{binding.action}</span>
                                <button 
                                    class="key-button {editingIndex === i ? 'editing' : ''}"
                                    on:click={() => startCapture(i)}
                                >
                                    {editingIndex === i ? 'Press any key...' : formatKey(binding)}
                                </button>
                            </div>
                        {/each}
                    </div>
                    <button class="reset-btn" on:click={resetToDefaults}>Reset to Defaults</button>
                </section>

                <section>
                    <h3>Navigation Sensitivity</h3>
                    <div class="settings-grid">
                        <div class="setting-group">
                            <label>Zoom Sensitivity ({$viewSettings.zoomSensitivity})</label>
                            <input type="range" min="0.1" max="5" step="0.1" bind:value={$viewSettings.zoomSensitivity} />
                        </div>
                        <div class="setting-group">
                            <label>Pan Sensitivity ({$viewSettings.panSensitivity})</label>
                            <input type="range" min="0.1" max="5" step="0.1" bind:value={$viewSettings.panSensitivity} />
                        </div>
                    </div>
                </section>

                <section>
                    <h3>Macro Slots</h3>
                    <div class="macro-slots">
                        {#each $macroSlots as slot, i}
                            <div class="macro-slot">
                                <input 
                                    type="text" 
                                    bind:value={slot.name}
                                    placeholder="Macro {i + 1}"
                                    class="macro-name-input"
                                />
                                <button 
                                    class="key-button {editingMacroIndex === i ? 'editing' : ''}"
                                    on:click={() => startMacroCapture(i)}
                                    title="Click to assign key"
                                >
                                    {editingMacroIndex === i ? 'Press key...' : (slot.keyBinding || 'None')}
                                </button>
                                <span class="macro-actions">{slot.actions.length} actions</span>
                            </div>
                        {/each}
                    </div>
                </section>

                <section>
                    <h3>Ollama / Translation</h3>
                    <div class="settings-grid">
                        <div class="setting-group">
                            <label>Ollama URL</label>
                            <input type="text" bind:value={$ollamaSettings.url} placeholder="http://localhost:11434" />
                        </div>
                        <div class="setting-group">
                            <label>Model</label>
                            <div class="model-input-group">
                                <input type="text" bind:value={$ollamaSettings.model} placeholder="llama3" list="model-list" />
                                <datalist id="model-list">
                                    {#each availableModels as model}
                                        <option value={model} />
                                    {/each}
                                </datalist>
                                <button class="fetch-btn" on:click={fetchModels} disabled={isFetchingModels}>
                                    {isFetchingModels ? '...' : '↻'}
                                </button>
                        </div>
                        <div class="setting-group">
                            <label>Target Language (Translation)</label>
                            <input type="text" bind:value={$ollamaSettings.targetLanguage} placeholder="English" />
                        </div>
                        <div class="setting-group">
                            <label for="ocr-language">OCR Language:</label>
                            <select id="ocr-language" bind:value={$ollamaSettings.ocrLanguage}>
                                <option value="eng">English</option>
                                <option value="jpn">Japanese</option>
                                <option value="chi_sim">Chinese (Simplified)</option>
                                <option value="chi_tra">Chinese (Traditional)</option>
                                <option value="kor">Korean</option>
                                <option value="fra">French</option>
                                <option value="deu">German</option>
                                <option value="spa">Spanish</option>
                            </select>
                        </div>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" bind:checked={$ollamaSettings.useVision} />
                                Use Vision Model (for better Japanese/Chinese OCR)
                            </label>
                            <p class="setting-hint">Enable this if using a vision-enabled model like llava or llama3.2-vision. Skips Tesseract and sends image directly to LLM.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
{/if}

<style>

    .settings-modal {
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        padding: 0;
    }

    .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .settings-header h2 {
        margin: 0;
        color: white;
        font-size: 24px;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 5px 10px;
        border-radius: 4px;
        transition: background 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .settings-content {
        padding: 20px;
    }

    section {
        margin-bottom: 30px;
    }

    section h3 {
        color: rgba(255, 255, 255, 0.9);
        font-size: 18px;
        margin-bottom: 15px;
        margin-top: 0;
    }

    .keybindings-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .keybinding-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
    }

    .action-name {
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
        text-transform: capitalize;
    }

    .key-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 6px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-family: monospace;
        font-size: 13px;
        min-width: 120px;
        transition: all 0.2s;
    }

    .key-button:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: var(--accent-color);
    }

    .key-button.editing {
        border-color: var(--accent-color);
        animation: pulse 1s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }

    .reset-btn {
        margin-top: 15px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .reset-btn:hover {
        background: rgba(255, 255, 255, 0.15);
    }

    .macro-slots {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .macro-slot {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: center;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
    }

    .macro-name-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        outline: none;
        font-size: 13px;
    }

    .macro-name-input:focus {
        border-color: var(--accent-color);
    }

    .macro-key {
        background: rgba(255, 255, 255, 0.1);
        padding: 4px 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
    }

    .macro-actions {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
        min-width: 80px;
        text-align: right;
    }

    .settings-grid {
        display: grid;
        gap: 15px;
    }

    .setting-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .setting-group label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
    }

    .setting-group input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        outline: none;
        font-size: 14px;
    }

    .setting-group input:focus, .setting-group select:focus {
        border-color: var(--accent-color);
    }

    .setting-group select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        outline: none;
        font-size: 14px;
    }

    .settings-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .setting-hint {
        margin: 5px 0 0 0;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
    }

    .model-input-group {
        display: flex;
        gap: 5px;
    }

    .model-input-group input {
        flex: 1;
    }

    .fetch-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 0 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .fetch-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }
</style>
