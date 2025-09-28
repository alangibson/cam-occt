<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { parseDXF, applyImportUnitConversion } from '$lib/parsers/dxf';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { Unit, getUnitSymbol } from '$lib/utils/units';

    const dispatch = createEventDispatcher();

    let fileInput: HTMLInputElement;
    let isDragging = false;
    let originalUnits: Unit | null = null;

    $: fileName = $drawingStore.fileName;
    $: settings = $settingsStore.settings;

    // Reset originalUnits when no file is loaded
    $: if (!fileName) {
        originalUnits = null;
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

                    // Store original units before conversion
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

    <button class="import-button" on:click={() => fileInput.click()}>
        Open DXF
    </button>

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
