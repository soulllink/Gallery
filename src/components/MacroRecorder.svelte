<script lang="ts">
    import {
        isRecording,
        currentRecordingSlot,
        recordedActions,
        macroSlots,
    } from "../stores";
    import type { MacroSlot } from "../stores";

    let showMacroPanel = false;

    function startRecording(slotIndex: number) {
        currentRecordingSlot.set(slotIndex);
        recordedActions.set([]);
        isRecording.set(true);
    }

    function stopRecording() {
        if ($isRecording && $currentRecordingSlot >= 0) {
            macroSlots.update((slots) => {
                slots[$currentRecordingSlot].actions = [...$recordedActions];
                return slots;
            });
        }
        isRecording.set(false);
        currentRecordingSlot.set(-1);
        recordedActions.set([]);
    }

    async function playMacro(slotIndex: number) {
        const slot = $macroSlots[slotIndex];
        if (slot.actions.length === 0) return;

        // Dispatch custom event with macro actions
        window.dispatchEvent(
            new CustomEvent("playMacro", { detail: slot.actions }),
        );
    }

    function clearMacro(slotIndex: number) {
        macroSlots.update((slots) => {
            slots[slotIndex].actions = [];
            return slots;
        });
    }

    function togglePanel() {
        showMacroPanel = !showMacroPanel;
    }

    function saveMacros() {
        const data = JSON.stringify($macroSlots);
        localStorage.setItem("gallery-macros", data);
        console.log("Macros saved");
    }

    function loadMacros() {
        const data = localStorage.getItem("gallery-macros");
        if (data) {
            try {
                const loaded = JSON.parse(data);
                macroSlots.set(loaded);
                console.log("Macros loaded");
            } catch (e) {
                console.error("Failed to load macros:", e);
            }
        }
    }
</script>

<div class="macro-controls">
    <button class="macro-toggle-btn" on:click={togglePanel} title="Macros">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
        </svg>
        {#if $isRecording}
            <span class="recording-indicator"></span>
        {/if}
    </button>

    {#if showMacroPanel}
        <div class="macro-panel glass-panel">
            <div class="macro-header">
                <h3>Macro Recorder</h3>
                <div class="macro-actions">
                    <button
                        class="action-btn"
                        on:click={saveMacros}
                        title="Save Macros">S</button
                    >
                    <button
                        class="action-btn"
                        on:click={loadMacros}
                        title="Load Macros">L</button
                    >
                </div>
            </div>

            {#if $isRecording}
                <div class="recording-banner">
                    <span class="pulse-dot"></span>
                    Recording to Slot {$currentRecordingSlot + 1}... ({$recordedActions.length}
                    actions)
                    <button class="stop-btn" on:click={stopRecording}
                        >Stop</button
                    >
                </div>
            {/if}

            <div class="macro-slots-list">
                {#each $macroSlots as slot, i}
                    <div
                        class="macro-slot-item {$currentRecordingSlot === i
                            ? 'recording'
                            : ''}"
                    >
                        <div class="slot-info">
                            <span class="slot-number">{i + 1}</span>
                            <input
                                type="text"
                                bind:value={slot.name}
                                class="slot-name"
                                placeholder="Macro {i + 1}"
                            />
                            <span class="slot-key"
                                >{slot.keyBinding || "-"}</span
                            >
                            <span class="slot-count">{slot.actions.length}</span
                            >
                        </div>
                        <div class="slot-controls">
                            {#if !$isRecording}
                                <button
                                    class="ctrl-btn record-btn"
                                    on:click={() => startRecording(i)}
                                    title="Record">⏺</button
                                >
                            {/if}
                            <button
                                class="ctrl-btn play-btn"
                                on:click={() => playMacro(i)}
                                disabled={slot.actions.length === 0}
                                title="Play">▶</button
                            >
                            <button
                                class="ctrl-btn clear-btn"
                                on:click={() => clearMacro(i)}
                                disabled={slot.actions.length === 0}
                                title="Clear">🗑</button
                            >
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .macro-controls {
        position: relative;
    }

    .macro-toggle-btn {
        position: relative;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .macro-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .recording-indicator {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 8px;
        height: 8px;
        background: #ff0000;
        border-radius: 50%;
        animation: pulse 1s infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }

    .macro-panel {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        width: 400px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 100;
        padding: 0;
    }

    .macro-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .macro-header h3 {
        margin: 0;
        font-size: 16px;
        color: white;
    }

    .macro-actions {
        display: flex;
        gap: 5px;
    }

    .action-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        min-width: 24px;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .recording-banner {
        background: rgba(255, 0, 0, 0.2);
        border: 1px solid rgba(255, 0, 0, 0.5);
        padding: 10px 15px;
        margin: 10px 15px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: white;
    }

    .pulse-dot {
        width: 10px;
        height: 10px;
        background: #ff0000;
        border-radius: 50%;
        animation: pulse 1s infinite;
    }

    .stop-btn {
        margin-left: auto;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    }

    .stop-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .macro-slots-list {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .macro-slot-item {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
    }

    .macro-slot-item.recording {
        border-color: #ff0000;
        background: rgba(255, 0, 0, 0.1);
    }

    .slot-info {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
    }

    .slot-number {
        background: rgba(255, 255, 255, 0.1);
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
    }

    .slot-name {
        background: transparent;
        border: none;
        color: white;
        font-size: 13px;
        outline: none;
        flex: 1;
        padding: 4px;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
    }

    .slot-name:focus {
        border-bottom-color: var(--accent-color);
    }

    .slot-key {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
    }

    .slot-count {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        min-width: 32px;
        text-align: right;
    }

    .slot-controls {
        display: flex;
        gap: 2px;
        padding: 4px;
    }

    .ctrl-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 14px;
        transition: all 0.2s;
    }

    .ctrl-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
    }

    .ctrl-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .record-btn:hover {
        background: rgba(255, 0, 0, 0.3);
    }

    .play-btn:hover:not(:disabled) {
        background: rgba(0, 255, 0, 0.3);
    }

    .clear-btn:hover:not(:disabled) {
        background: rgba(255, 100, 100, 0.3);
    }
</style>
