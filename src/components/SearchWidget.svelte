<script lang="ts">
    import { files, gotoFile } from '../stores';
    
    let searchQuery = '';
    let isFocused = false;
    let selectedIndex = 0;

    $: filteredFiles = searchQuery.trim() 
        ? $files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
        : [];

    function handleKeydown(e: KeyboardEvent) {
        if (!isFocused) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredFiles[selectedIndex]) {
                const index = $files.indexOf(filteredFiles[selectedIndex]);
                if (index !== -1) {
                    gotoFile(index);
                    searchQuery = '';
                    (e.target as HTMLInputElement).blur();
                }
            }
        } else if (e.key === 'Escape') {
            searchQuery = '';
            (e.target as HTMLInputElement).blur();
        }
    }

    function selectFile(file: any) {
        const index = $files.indexOf(file);
        if (index !== -1) {
            gotoFile(index);
            searchQuery = '';
        }
    }
</script>

<div class="search-container">
    <div id="poda">
        <div class="glow"></div>
        <div class="darkBorderBg"></div>
        <div class="darkBorderBg"></div>
        <div class="darkBorderBg"></div>

        <div class="white"></div>

        <div class="border"></div>

        <div id="main">
            <input 
                placeholder="Search..." 
                type="text" 
                name="text" 
                class="input"
                bind:value={searchQuery}
                on:focus={() => isFocused = true}
                on:blur={() => setTimeout(() => isFocused = false, 200)}
                on:keydown={handleKeydown}
            />
            <div id="input-mask"></div>
            <div id="pink-mask"></div>
            <div id="search-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" height="24" fill="none" class="feather feather-search">
                    <circle stroke="url(#search)" r="8" cy="11" cx="11"></circle>
                    <line stroke="url(#searchl)" y2="16.65" y1="22" x2="16.65" x1="22"></line>
                    <defs>
                        <linearGradient gradientTransform="rotate(50)" id="search">
                            <stop stop-color="#f8e7f8" offset="0%"></stop>
                            <stop stop-color="#b6a9b7" offset="50%"></stop>
                        </linearGradient>
                        <linearGradient id="searchl">
                            <stop stop-color="#b6a9b7" offset="0%"></stop>
                            <stop stop-color="#837484" offset="50%"></stop>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </div>
    </div>
    
    {#if isFocused && filteredFiles.length > 0}
        <div class="dropdown">
            {#each filteredFiles as file, i}
                <div 
                    class="dropdown-item {i === selectedIndex ? 'selected' : ''}"
                    on:click={() => selectFile(file)}
                >
                    {file.name}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .search-container {
        position: relative;
        transform: scale(0.8);
        transform-origin: center;
    }

    .white,
    .border,
    .darkBorderBg,
    .glow {
        max-height: 70px;
        max-width: 314px;
        height: 100%;
        width: 100%;
        position: absolute;
        overflow: hidden;
        z-index: -1;
        border-radius: 12px;
        filter: blur(3px);
    }
    
    .input {
        background-color: #010201;
        border: none;
        width: 301px;
        height: 56px;
        border-radius: 10px;
        color: white;
        padding-inline: 59px;
        font-size: 18px;
    }
    
    #poda {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .input::placeholder {
        color: #c0b9c0;
    }

    .input:focus {
        outline: none;
    }

    #main:focus-within > #input-mask {
        display: none;
    }

    #input-mask {
        pointer-events: none;
        width: 100px;
        height: 20px;
        position: absolute;
        background: linear-gradient(90deg, transparent, black);
        top: 18px;
        left: 70px;
    }
    
    #pink-mask {
        pointer-events: none;
        width: 30px;
        height: 20px;
        position: absolute;
        background: #cf30aa;
        top: 10px;
        left: 5px;
        filter: blur(20px);
        opacity: 0.8;
        transition: all 2s;
    }
    
    #main:hover > #pink-mask {
        opacity: 0;
    }

    .white {
        max-height: 63px;
        max-width: 307px;
        border-radius: 10px;
        filter: blur(2px);
    }

    .white::before {
        content: "";
        z-index: -2;
        text-align: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(83deg);
        position: absolute;
        width: 600px;
        height: 600px;
        background-repeat: no-repeat;
        background-position: 0 0;
        filter: brightness(1.4);
        background-image: conic-gradient(
            rgba(0, 0, 0, 0) 0%,
            #a099d8,
            rgba(0, 0, 0, 0) 8%,
            rgba(0, 0, 0, 0) 50%,
            #dfa2da,
            rgba(0, 0, 0, 0) 58%
        );
        transition: all 2s;
    }
    
    .border {
        max-height: 59px;
        max-width: 303px;
        border-radius: 11px;
        filter: blur(0.5px);
    }
    
    .border::before {
        content: "";
        z-index: -2;
        text-align: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(70deg);
        position: absolute;
        width: 600px;
        height: 600px;
        filter: brightness(1.3);
        background-repeat: no-repeat;
        background-position: 0 0;
        background-image: conic-gradient(
            #1c191c,
            #402fb5 5%,
            #1c191c 14%,
            #1c191c 50%,
            #cf30aa 60%,
            #1c191c 64%
        );
        transition: all 2s;
    }
    
    .darkBorderBg {
        max-height: 65px;
        max-width: 312px;
    }
    
    .darkBorderBg::before {
        content: "";
        z-index: -2;
        text-align: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(82deg);
        position: absolute;
        width: 600px;
        height: 600px;
        background-repeat: no-repeat;
        background-position: 0 0;
        background-image: conic-gradient(
            rgba(0, 0, 0, 0),
            #18116a,
            rgba(0, 0, 0, 0) 10%,
            rgba(0, 0, 0, 0) 50%,
            #6e1b60,
            rgba(0, 0, 0, 0) 60%
        );
        transition: all 2s;
    }
    
    #poda:hover > .darkBorderBg::before {
        transform: translate(-50%, -50%) rotate(262deg);
    }
    
    #poda:hover > .glow::before {
        transform: translate(-50%, -50%) rotate(240deg);
    }
    
    #poda:hover > .white::before {
        transform: translate(-50%, -50%) rotate(263deg);
    }
    
    #poda:hover > .border::before {
        transform: translate(-50%, -50%) rotate(250deg);
    }

    #poda:hover > .darkBorderBg::before {
        transform: translate(-50%, -50%) rotate(-98deg);
    }
    
    #poda:hover > .glow::before {
        transform: translate(-50%, -50%) rotate(-120deg);
    }
    
    #poda:hover > .white::before {
        transform: translate(-50%, -50%) rotate(-97deg);
    }
    
    #poda:hover > .border::before {
        transform: translate(-50%, -50%) rotate(-110deg);
    }

    #poda:focus-within > .darkBorderBg::before {
        transform: translate(-50%, -50%) rotate(442deg);
        transition: all 4s;
    }
    
    #poda:focus-within > .glow::before {
        transform: translate(-50%, -50%) rotate(420deg);
        transition: all 4s;
    }
    
    #poda:focus-within > .white::before {
        transform: translate(-50%, -50%) rotate(443deg);
        transition: all 4s;
    }
    
    #poda:focus-within > .border::before {
        transform: translate(-50%, -50%) rotate(430deg);
        transition: all 4s;
    }

    .glow {
        overflow: hidden;
        filter: blur(30px);
        opacity: 0.4;
        max-height: 130px;
        max-width: 354px;
    }
    
    .glow:before {
        content: "";
        z-index: -2;
        text-align: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(60deg);
        position: absolute;
        width: 999px;
        height: 999px;
        background-repeat: no-repeat;
        background-position: 0 0;
        background-image: conic-gradient(
            #000,
            #402fb5 5%,
            #000 38%,
            #000 50%,
            #cf30aa 60%,
            #000 87%
        );
        transition: all 2s;
    }

    @keyframes rotate {
        100% {
            transform: translate(-50%, -50%) rotate(450deg);
        }
    }

    #main {
        position: relative;
    }
    
    #search-icon {
        position: absolute;
        left: 20px;
        top: 15px;
    }

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        margin-top: 4px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .dropdown-item {
        padding: 8px 12px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .dropdown-item:hover, .dropdown-item.selected {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }
</style>
