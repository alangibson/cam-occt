<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { SelectionMode } from '$lib/stores/settings/interfaces';
    import {
        calculateDrawingSize,
        type DrawingSize,
    } from '$lib/algorithms/drawing-size/drawing-size';

    $: drawing = $drawingStore.drawing;
    $: scale = $drawingStore.scale;
    $: fileName = $drawingStore.fileName;
    $: selectionMode = $settingsStore.settings.selectionMode;
    let drawingSize: DrawingSize | null = null;

    // Watch for drawing changes
    let previousDrawing: typeof drawing | null = null;

    // Manual effect tracking
    $: {
        if (drawing !== previousDrawing) {
            previousDrawing = drawing;
            if (drawing) {
                try {
                    drawingSize = calculateDrawingSize(drawing);
                } catch (error) {
                    console.error('Error calculating drawing size:', error);
                    drawingSize = null;
                }
            } else {
                drawingSize = null;
            }
        }
    }

    function formatSize(size: number, units: string): string {
        return `${size.toFixed(2)} ${units}`;
    }

    function formatZoom(scale: number): string {
        return `${(scale * 100).toFixed(0)}%`;
    }

    function handleFitClick() {
        drawingStore.zoomToFit();
    }

    function handleZoom100Click() {
        drawingStore.setViewTransform(1, $drawingStore.offset);
    }

    function handleSelectionModeChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        settingsStore.setSelectionMode(select.value as SelectionMode);
    }
</script>

<footer class="footer">
    <div class="drawing-info">
        <div class="left-info">
            {#if fileName}
                <span class="file-name">{fileName}</span>
            {/if}
            {#if drawingSize}
                <span class="size-info">
                    Size: {formatSize(drawingSize.width, drawingSize.units)} × {formatSize(
                        drawingSize.height,
                        drawingSize.units
                    )}
                    {#if drawingSize.source === 'calculated'}
                        <span class="source-note">(calculated)</span>
                    {/if}
                </span>
            {:else if drawing}
                <span class="no-size">Unable to calculate size</span>
            {:else}
                <span class="no-drawing">No drawing loaded</span>
            {/if}
        </div>

        <div class="selection-controls">
            <label for="selection-mode" class="selection-label"
                >Selection:</label
            >
            <select
                id="selection-mode"
                class="selection-dropdown"
                value={selectionMode}
                on:change={handleSelectionModeChange}
            >
                <option value={SelectionMode.Auto}>Auto</option>
                <option value={SelectionMode.Chain}>Chain</option>
                <option value={SelectionMode.Shape}>Shape</option>
                <option value={SelectionMode.Part}>Part</option>
                <option value={SelectionMode.Cut}>Cut</option>
                <option value={SelectionMode.Lead}>Lead</option>
            </select>
        </div>

        <div class="zoom-controls">
            <span class="zoom-info">Zoom: {formatZoom(scale)}</span>
            <button
                class="fit-button"
                on:click={handleFitClick}
                disabled={!drawing}
                title="Zoom to fit"
            >
                Fit
            </button>
            <button
                class="fit-button"
                on:click={handleZoom100Click}
                disabled={!drawing}
                title="Zoom to 100%"
            >
                100%
            </button>
        </div>
    </div>
</footer>

<style>
    .footer {
        background-color: #f5f5f5;
        border-top: 1px solid #ddd;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        color: #666;
    }

    .drawing-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .left-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .file-name {
        font-weight: 600;
        color: #333;
    }

    .size-info {
        font-family: 'Courier New', monospace;
        font-weight: 500;
    }

    .source-note {
        font-size: 0.8rem;
        opacity: 0.7;
        margin-left: 0.5rem;
    }

    .no-size {
        color: #cc6600;
    }

    .no-drawing {
        color: #999;
    }

    .selection-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .selection-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #333;
    }

    .selection-dropdown {
        padding: 0.25rem 0.5rem;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        color: #333;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .selection-dropdown:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }

    .selection-dropdown:focus {
        outline: none;
        border-color: #666;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
    }

    .zoom-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .zoom-info {
        font-family: 'Courier New', monospace;
        font-weight: 500;
        color: #333;
    }

    .fit-button {
        padding: 0.25rem 0.75rem;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        color: #333;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .fit-button:hover:not(:disabled) {
        background-color: #f0f0f0;
        border-color: #999;
    }

    .fit-button:active:not(:disabled) {
        background-color: #e0e0e0;
    }

    .fit-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
