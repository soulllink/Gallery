<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';

    export let x: number;
    export let y: number;
    export let visible: boolean;

    const dispatch = createEventDispatcher();

    function handleAction(action: string) {
        dispatch('action', action);
    }
</script>

{#if visible}
    <div 
        class="context-menu glass-panel" 
        style="top: {y}px; left: {x}px;"
        transition:fade={{ duration: 100 }}
        on:contextmenu|preventDefault
        role="menu"
        tabindex="0"
    >
        <button class="menu-item" on:click={() => handleAction('open')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Open
        </button>
        <button class="menu-item" on:click={() => handleAction('reveal')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Reveal in Explorer
        </button>
        <button class="menu-item" on:click={() => handleAction('copy')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy File
        </button>
        <div class="separator"></div>
        <button class="menu-item delete" on:click={() => handleAction('delete')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
        </button>
        <button class="menu-item" on:click={() => handleAction('properties')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Properties
        </button>
    </div>
{/if}

<style>
    .context-menu {
        position: fixed;
        z-index: 1000;
        background: rgba(15, 15, 16, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 5px;
        min-width: 180px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        color: rgba(255, 255, 255, 0.8);
        background: transparent;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        text-align: left;
        transition: all 0.2s;
        width: 100%;
    }

    .menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }

    .menu-item.delete:hover {
        background: rgba(255, 50, 50, 0.2);
        color: #ff4d4d;
    }

    .separator {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 4px 0;
    }
</style>
