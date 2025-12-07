<script lang="ts">
    import { untrack } from 'svelte';
    import { parseDXF } from '$lib/parsers/dxf/functions';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { Unit, measurementSystemToUnit } from '$lib/config/units/units';
    import type { DrawingData } from '$lib/cam/drawing/interfaces';
    import { Drawing } from '$lib/cam/drawing/classes.svelte';
    import type { ApplicationSettings } from '$lib/config/settings/interfaces';
    import { ImportUnitSetting } from '$lib/config/settings/enums';

    /**
     * Apply unit override to a drawing based on application settings
     * This function only changes the unit label without converting geometry values
     */
    function applyImportUnitConversion(
        drawing: DrawingData,
        settings: ApplicationSettings
    ): DrawingData {
        // Determine target unit based on import setting
        let targetUnit: Unit;

        switch (settings.importUnitSetting) {
            case ImportUnitSetting.Automatic:
                // Use the file's detected units - no override
                return drawing;

            case ImportUnitSetting.Application:
                // Override to application's measurement system
                targetUnit = measurementSystemToUnit(
                    settings.measurementSystem
                );
                break;

            case ImportUnitSetting.Metric:
                // Force metric units
                targetUnit = Unit.MM;
                break;

            case ImportUnitSetting.Imperial:
                // Force imperial units
                targetUnit = Unit.INCH;
                break;

            default:
                // Fallback to automatic behavior
                return drawing;
        }

        // If no override needed, return original drawing
        if (drawing.units === targetUnit) {
            return drawing;
        }

        // Only change the unit label, keep all geometry values unchanged
        return {
            ...drawing,
            units: targetUnit,
        };
    }

    interface Props {
        onimportAdvance?: () => void;
        onfileImported?: (detail: {
            drawing: DrawingData;
            fileName: string;
            originalUnits: Unit | null;
        }) => void;
    }

    let { onimportAdvance, onfileImported }: Props = $props();

    let fileInput: HTMLInputElement | undefined = $state();
    let isDragging = $state(false);
    let originalUnits: Unit | null = $state(null);
    let originalDrawing: DrawingData | null = $state(null);
    let settingsEffectInitialized = $state(false);

    let fileName = $derived(drawingStore.drawing?.fileName ?? null);
    let settings = $derived(settingsStore.settings);

    // Reset originalUnits and originalDrawing when no file is loaded
    $effect(() => {
        if (!fileName) {
            originalUnits = null;
            originalDrawing = null;
            settingsEffectInitialized = false;
        }
    });

    // Re-apply unit conversion when settings change (not on initial import)
    $effect(() => {
        // Only track settings as the dependency
        const currentSettings = settings;

        untrack(() => {
            if (originalDrawing && currentSettings && fileName) {
                if (settingsEffectInitialized) {
                    const convertedDrawing = applyImportUnitConversion(
                        originalDrawing,
                        currentSettings
                    );
                    drawingStore.setDrawing(
                        new Drawing(convertedDrawing),
                        fileName
                    );
                } else {
                    settingsEffectInitialized = true;
                }
            }
        });
    });

    async function handleFiles(files: FileList | null) {
        console.log('[handleFiles] Starting file handling...');
        if (!files || files.length === 0) {
            console.log('[handleFiles] No files provided, returning');
            return;
        }

        const file = files[0];
        console.log(
            '[handleFiles] Processing file:',
            file.name,
            'size:',
            file.size,
            'bytes'
        );
        const reader = new FileReader();

        reader.onload = async (e) => {
            console.log('[handleFiles] File read complete, parsing content...');
            const content = e.target?.result as string;

            try {
                let drawing;

                if (file.name.toLowerCase().endsWith('.dxf')) {
                    console.log(
                        '[handleFiles] Detected DXF file, calling parseDXF...'
                    );
                    // Parse DXF file
                    const parsedDrawing: DrawingData = await parseDXF(content);
                    console.log(
                        '[handleFiles] DXF parsed, shapes:',
                        parsedDrawing.shapes.length,
                        'units:',
                        parsedDrawing.units
                    );

                    // Store original drawing and units before conversion
                    originalDrawing = parsedDrawing;
                    originalUnits = parsedDrawing.units;

                    // Apply unit conversion based on application settings
                    console.log('[handleFiles] Applying unit conversion...');
                    drawing = applyImportUnitConversion(
                        parsedDrawing,
                        settings
                    );

                    // Add fileName to the drawing data
                    drawing.fileName = file.name;

                    console.log('[handleFiles] Setting drawing in store...');
                    drawingStore.setDrawing(new Drawing(drawing), file.name);
                    onfileImported?.({
                        drawing,
                        fileName: file.name,
                        originalUnits,
                    });
                    console.log(
                        '[handleFiles] File import completed successfully'
                    );
                } else {
                    console.log(
                        '[handleFiles] Unsupported file format:',
                        file.name
                    );
                    alert('Unsupported file format. Please use DXF files.');
                    return;
                }
            } catch (error) {
                console.error('[handleFiles] Error parsing file:', error);
                alert('Error parsing file. Please check the file format.');
            }
        };

        console.log('[handleFiles] Reading file as text...');
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
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    role="region"
    aria-label="File import area"
>
    <input
        bind:this={fileInput}
        type="file"
        accept=".dxf"
        onchange={(e) => handleFiles(e.currentTarget.files)}
        style="display: none;"
    />

    <div class="button-container">
        <button class="import-button" onclick={() => fileInput?.click()}>
            Open DXF
        </button>
        <button
            class="advance-button"
            disabled={!fileName}
            onclick={() => onimportAdvance?.()}
        >
            Import
        </button>
    </div>

    {#if fileName}
        <p class="filename">
            Loaded: {fileName}
            <span class="units">({originalUnits})</span>
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
