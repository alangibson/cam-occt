<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { Unit, measurementSystemToUnit } from '$lib/config/units/units';
    import type { DrawingData } from '$lib/cam/drawing/interfaces';
    import { File as CAMFile } from '$lib/cam/file/classes';

    interface Props {
        onimportAdvance?: () => void;
        onfileImported?: (detail: {
            drawing: DrawingData;
            fileName: string;
            originalUnits: Unit | null;
        }) => void;
        externalFileContent?: string | null;
        externalFileName?: string | null;
    }

    let {
        onimportAdvance,
        onfileImported,
        externalFileContent,
        externalFileName,
    }: Props = $props();

    let fileInput: HTMLInputElement | undefined = $state();
    let isDragging = $state(false);
    let loadedFile: CAMFile | null = $state(null);
    let fileUnit: Unit | null = $state(null);

    let settings = $derived(settingsStore.settings);

    // Load file unit when file is loaded
    $effect(() => {
        if (loadedFile) {
            loadedFile.getUnit().then((unit) => {
                fileUnit = unit;
            });
        } else {
            fileUnit = null;
        }
    });

    async function handleFileLoad(content: string, fileName: string) {
        try {
            const fileType = CAMFile.getFileTypeFromName(fileName);

            if (!fileType) {
                alert('Unsupported file format. Please use DXF or SVG files.');
                return;
            }

            // Create File object but don't parse yet
            loadedFile = new CAMFile(fileName, fileType, content);
        } catch (error) {
            alert('Error loading file. Please check the file format.');
            console.error(error);
        }
    }

    async function handleImportClick() {
        if (!loadedFile) return;

        try {
            // Determine application unit
            const applicationUnit = measurementSystemToUnit(
                settings.measurementSystem
            );

            // Convert file to drawing with unit conversion
            // File class handles all conversion logic based on import setting
            const drawing = await loadedFile.toDrawing(
                applicationUnit,
                settings.importUnitSetting
            );

            // Store in drawing store
            drawingStore.setDrawing(drawing, loadedFile.name);

            // Notify parent
            onfileImported?.({
                drawing: drawing.toData(),
                fileName: loadedFile.name,
                originalUnits: fileUnit,
            });

            // Advance to next stage
            onimportAdvance?.();
        } catch (error) {
            alert('Error importing file. Please check the file format.');
            console.error(error);
        }
    }

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            const content = e.target?.result as string;
            await handleFileLoad(content, file.name);
        };

        reader.readAsText(file);
    }

    // Handle external file loading from gallery
    $effect(() => {
        if (externalFileContent && externalFileName) {
            handleFileLoad(externalFileContent, externalFileName).then(() => {
                // Auto-import when loaded from gallery
                handleImportClick();
            });
        }
    });

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
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    role="region"
    aria-label="File import area"
>
    <input
        bind:this={fileInput}
        type="file"
        accept=".dxf,.svg"
        onchange={(e) => handleFiles(e.currentTarget.files)}
        style="display: none;"
    />

    <div class="button-container">
        <button class="import-button" onclick={() => fileInput?.click()}>
            Open DXF/SVG
        </button>
        <button
            class="advance-button"
            disabled={!loadedFile}
            onclick={handleImportClick}
        >
            Import
        </button>
    </div>

    {#if loadedFile}
        <p class="filename">
            Loaded: {loadedFile.name}
            <span class="units">({fileUnit ?? 'detecting...'})</span>
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
