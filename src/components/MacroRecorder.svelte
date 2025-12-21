<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { 
        isRecording, 
        currentRecordingSlot, 
        recordedActions, 
        macroSlots,
        files
    } from '../stores';
    import type { MacroSlot, MacroAction } from '../stores';
    import { save, open } from '@tauri-apps/plugin-dialog';
    import { writeTextFile, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

    const dispatch = createEventDispatcher();

    let showMacroPanel = false;
    let slideShowInterval = "3";
    let expandedSlot = -1;

    function togglePanel() {
        showMacroPanel = !showMacroPanel;
    }

    function startRecording(slotIndex: number) {
        if ($isRecording) return;
        currentRecordingSlot.set(slotIndex);
        recordedActions.set([]); // Clear previous recording for this session
        isRecording.set(true);
        // Clear the target slot immediately
        macroSlots.update(slots => {
            slots[slotIndex].actions = [];
            return slots;
        });
    }

    function stopRecording() {
        if (!$isRecording) return;
        
        // Save recorded actions to the slot
        macroSlots.update(slots => {
            // We append the final recorded actions
            // Note: actions are pushed to recordedActions store during recording by CanvasView/Renderer
            slots[$currentRecordingSlot].actions = $recordedActions;
            return slots;
        });

        isRecording.set(false);
        currentRecordingSlot.set(-1);
        recordedActions.set([]);
    }

    function playMacro(slotIndex: number) {
        const slot = $macroSlots[slotIndex];
        if (!slot || slot.actions.length === 0) return;

        // Dispatch event to parent (App/CanvasView) to handle playback
        // We can use a custom window event or the svelte dispatcher
        // Using window event for global access matches the previous pattern
        const event = new CustomEvent('playMacro', { 
            detail: {
                actions: slot.actions,
                loop: slot.loop
            }
        });
        window.dispatchEvent(event);
    }

    function clearMacro(slotIndex: number) {
        if (confirm('Clear this macro?')) {
            macroSlots.update(slots => {
                slots[slotIndex].actions = [];
                slots[slotIndex].name = '';
                slots[slotIndex].loop = false;
                return slots;
            });
        }
    }

    function toggleAutoLoop(slotIndex: number) {
        macroSlots.update(slots => {
            slots[slotIndex].loop = !slots[slotIndex].loop;
            return slots;
        });
    }

    async function saveMacros() {
        try {
            const path = await save({
                filters: [{
                    name: 'JSON',
                    extensions: ['json']
                }]
            });
            if (path) {
                await writeTextFile(path, JSON.stringify($macroSlots, null, 2));
                alert('Macros saved successfully!');
            }
        } catch (e) {
            console.error('Failed to save macros:', e);
            alert('Failed to save macros.');
        }
    }

    async function loadMacros() {
        try {
            const path = await open({
                filters: [{
                    name: 'JSON',
                    extensions: ['json']
                }]
            });
            if (path && !Array.isArray(path)) {
                const content = await readTextFile(path);
                const loaded = JSON.parse(content);
                if (Array.isArray(loaded)) {
                    // Validate basic structure
                    macroSlots.set(loaded);
                    alert('Macros loaded successfully!');
                }
            }
        } catch (e) {
            console.error('Failed to load macros:', e);
            alert('Failed to load macros.');
        }
    }

    function createSlideShow() {
        // Find empty or ask overwrite
        let targetSlot = -1;
        for(let i=0; i<$macroSlots.length; i++) {
            if ($macroSlots[i].actions.length === 0) {
                targetSlot = i;
                break;
            }
        }
        if (targetSlot === -1) {
            targetSlot = 0; // Default to first if full
             if(!confirm("All slots likely full. Overwrite Slot 1?")) return;
        }

        const interval = parseFloat(slideShowInterval) || 3;
        const actions: MacroAction[] = [
            { type: 'wait', value: interval * 1000 },
            { type: 'navigate', value: 1 }
        ];

        macroSlots.update(slots => {
            slots[targetSlot].actions = actions;
            slots[targetSlot].name = `Slide Show (${interval}s)`;
            slots[targetSlot].loop = true;
            return slots;
        });
        
        // Automatically expand the slot to show it worked
        expandedSlot = targetSlot;
    }
</script>

<div class="macro-controls">
    <button class="macro-toggle-btn" on:click={togglePanel} title="Macros">
        <!-- SVG Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
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
                     <button class="action-btn" on:click={saveMacros} title="Save Macros">S</button>
                     <button class="action-btn" on:click={loadMacros} title="Load Macros">L</button>
                </div>
            </div>

            <!-- Slide Show Generator -->
             <div class="slide-show-gen">
                 <h4>Slide Show</h4>
                 <div class="gen-controls">
                     <input type="number" bind:value={slideShowInterval} min="0.1" step="0.5" />
                     <span>sec</span>
                     <button on:click={createSlideShow}>Create</button>
                 </div>
             </div>

            {#if $isRecording}
                <div class="recording-banner">
                    <span class="pulse-dot"></span>
                    Recording to Slot {$currentRecordingSlot + 1}... ({$recordedActions.length} actions)
                    <button class="stop-btn" on:click={stopRecording}>Stop</button>
                </div>
            {/if}

            <div class="macro-slots-list">
                {#each $macroSlots as slot, i}
                    <div class="macro-slot-container">
                        <div class="macro-slot-item {$currentRecordingSlot === i ? 'recording' : ''}">
                            <div class="slot-info" on:click={() => expandedSlot = expandedSlot === i ? -1 : i}>
                                <span class="slot-number">{i + 1}</span>
                                <input type="text" bind:value={slot.name} class="slot-name" placeholder="Macro {i + 1}" on:click|stopPropagation />
                                <span class="slot-key">{slot.keyBinding || "-"}</span>
                                <span class="slot-count">{slot.actions.length}</span>
                                <span class="expand-arrow">{expandedSlot === i ? '▼' : '▶'}</span>
                            </div>
                            <!-- Controls remain same -->
                            <div class="slot-controls">
                                <button class="ctrl-btn auto-btn {slot.loop ? 'active' : ''}" on:click={() => toggleAutoLoop(i)} title="Toggle Auto Loop (A)">A</button>
                                {#if !$isRecording}
                                    <button class="ctrl-btn record-btn" on:click={() => startRecording(i)} title="Record">⏺</button>
                                {/if}
                                <button class="ctrl-btn play-btn" on:click={() => playMacro(i)} disabled={slot.actions.length === 0} title="Play">▶</button>
                                <button class="ctrl-btn clear-btn" on:click={() => clearMacro(i)} disabled={slot.actions.length === 0} title="Clear">🗑</button>
                            </div>
                        </div>
                        
                        {#if expandedSlot === i && slot.actions.length > 0}
                            <div class="slot-details">
                                {#each slot.actions as action, idx}
                                    <div class="action-item">
                                        <span class="action-type">{action.type}</span>
                                        {#if action.type === 'wait'}
                                            <span class="action-val">{action.value}ms</span>
                                        {:else if typeof action.value === 'object'}
                                            <span class="action-val">...</span>
                                        {:else}
                                            <span class="action-val">{action.value}</span>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
   /* ... Keep existing styles ... */
   
   .slide-show-gen {
       padding: 10px 15px;
       border-bottom: 1px solid rgba(255,255,255,0.1);
   }
   .slide-show-gen h4 {
       margin: 0 0 5px 0;
       font-size: 13px;
       color: rgba(255,255,255,0.7);
   }
   .gen-controls {
       display: flex;
       align-items: center;
       gap: 8px;
   }
   .gen-controls input {
       width: 60px;
       background: rgba(255,255,255,0.1);
       border: 1px solid rgba(255,255,255,0.2);
       color: white;
       padding: 4px;
       border-radius: 4px;
   }
   .gen-controls button {
       background: var(--accent-color, #ff00ff);
       border: none;
       color: white;
       padding: 4px 12px;
       border-radius: 4px;
       cursor: pointer;
       font-size: 13px;
   }
   
   .expand-arrow {
       font-size: 10px;
       color: rgba(255,255,255,0.5);
       width: 15px;
       text-align: center;
       cursor: pointer;
   }
   
   .slot-details {
       background: rgba(0,0,0,0.2);
       padding: 5px;
       font-size: 12px;
       border-radius: 0 0 6px 6px;
       margin-top: -4px;
       margin-bottom: 8px;
   }
   .action-item {
       display: flex;
       justify-content: space-between;
       padding: 2px 8px;
       color: rgba(255,255,255,0.7);
   }
   .action-type {
       color: var(--secondary-color, #00ffff);
   }

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
        width: 480px; /* Widened from 400px */
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

    .auto-btn {
        font-weight: bold;
        color: rgba(255, 255, 255, 0.5);
    }

    .auto-btn.active {
        color: white;
        background: var(--accent-color);
        border-color: var(--accent-color);
    }
</style>
