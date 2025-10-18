<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { parseDXF, applyImportUnitConversion } from '$lib/parsers/dxf';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { Unit, getUnitSymbol } from '$lib/config/units/units';
    import type { Drawing } from '$lib/geometry/shape';

    const dispatch = createEventDispatcher();

    function handleImportClick() {
        dispatch('importAdvance');
    }

    let fileInput: HTMLInputElement;
    let isDragging = false;
    let originalUnits: Unit | null = null;
    let originalDrawing: Drawing | null = null;

    $: fileName = $drawingStore.fileName;
    $: settings = $settingsStore.settings;

    // Reset originalUnits and originalDrawing when no file is loaded
    $: if (!fileName) {
        originalUnits = null;
        originalDrawing = null;
    }

    // Re-apply unit conversion when settings change
    $: if (originalDrawing && settings) {
        const convertedDrawing = applyImportUnitConversion(
            originalDrawing,
            settings
        );
        drawingStore.setDrawing(convertedDrawing, fileName || undefined);
    }

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            const content = e.target?.result as string;

            try {
                let drawing;

                if (file.name.toLowerCase().endsWith('.dxf')) {
                    // Parse DXF file
                    const parsedDrawing = await parseDXF(content);

                    // Store original drawing and units before conversion
                    originalDrawing = parsedDrawing;
                    originalUnits = parsedDrawing.units;

                    // Apply unit conversion based on application settings
                    drawing = applyImportUnitConversion(
                        parsedDrawing,
                        settings
                    );

                    drawingStore.setDrawing(drawing, file.name);
                    dispatch('fileImported', {
                        drawing,
                        fileName: file.name,
                        originalUnits,
                    });
                } else {
                    alert('Unsupported file format. Please use DXF files.');
                    return;
                }
            } catch (error) {
                console.error('Error parsing file:', error);
                alert('Error parsing file. Please check the file format.');
            }
        };

        reader.readAsText(file);
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        handleFiles(e.dataTransfer?.files || null);
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }
</script>

<div
    class="file-import"
    class:dragging={isDragging}
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    role="region"
    aria-label="File import area"
>
    <input
        bind:this={fileInput}
        type="file"
        accept=".dxf"
        on:change={(e) => handleFiles(e.currentTarget.files)}
        style="display: none;"
    />

    <div class="button-container">
        <button class="import-button" on:click={() => fileInput.click()}>
            Open DXF
        </button>
        <button
            class="advance-button"
            disabled={!fileName}
            on:click={handleImportClick}
        >
            Import
        </button>
    </div>

    {#if fileName}
        <p class="filename">
            Loaded: {fileName}
            {#if originalUnits}
                <span class="units">({getUnitSymbol(originalUnits)})</span>
            {/if}
        </p>
    {:else}
        <p class="hint">or drag and drop a file here</p>
    {/if}
</div>

<style>
    .file-import {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
        transition: all 0.3s ease;
    }

    .file-import.dragging {
        border-color: rgb(0, 83, 135);
        background-color: #e6f2ff;
    }

    .button-container {
        display: flex;
        gap: 1rem;
        justify-content: center;
        align-items: center;
    }

    .import-button {
        background-color: rgb(0, 83, 135);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    }

    .import-button:hover {
        background-color: rgb(0, 83, 135);
    }

    .advance-button {
        background-color: #dc2626;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: background-color 0.2s ease;
    }

    .advance-button:hover:not(:disabled) {
        background-color: #b91c1c;
    }

    .advance-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
        opacity: 0.6;
    }

    .advance-button:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.3);
    }

    .hint {
        margin-top: 1rem;
        color: #666;
    }

    .filename {
        margin-top: 1rem;
        color: rgb(0, 83, 135);
        font-weight: 500;
    }

    .units {
        color: #6b7280;
        font-weight: 400;
        margin-left: 0.5rem;
    }
</style>
