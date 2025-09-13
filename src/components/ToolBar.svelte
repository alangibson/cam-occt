<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';

    $: selectedCount = $drawingStore.selectedShapes.size;
    $: fileName = $drawingStore.fileName;

    function handleScale() {
        const factor = parseFloat(prompt('Enter scale factor:', '1.5') || '1');
        if (factor && selectedCount > 0) {
            // Scale around center of selection
            drawingStore.scaleShapes(
                Array.from($drawingStore.selectedShapes),
                factor,
                { x: 0, y: 0 } // TODO: Calculate center of selection
            );
        }
    }

    function handleRotate() {
        const degrees = parseFloat(
            prompt('Enter rotation angle (degrees):', '45') || '0'
        );
        if (degrees && selectedCount > 0) {
            const radians = (degrees * Math.PI) / 180;
            drawingStore.rotateShapes(
                Array.from($drawingStore.selectedShapes),
                radians,
                { x: 0, y: 0 } // TODO: Calculate center of selection
            );
        }
    }
</script>

<div class="toolbar">
    <div class="toolbar-left">
        <div class="button-group">
            <button
                on:click={() => drawingStore.deleteSelected()}
                disabled={selectedCount === 0}
            >
                Delete ({selectedCount})
            </button>

            <button on:click={handleScale} disabled={selectedCount === 0}>
                Scale
            </button>

            <button on:click={handleRotate} disabled={selectedCount === 0}>
                Rotate
            </button>
        </div>
    </div>

    <div class="toolbar-right">
        {#if fileName}
            <span class="file-name">{fileName}</span>
        {/if}
    </div>
</div>

<style>
    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
    }

    .toolbar-left {
        display: flex;
        gap: 1rem;
    }

    .button-group {
        display: flex;
        gap: 0.5rem;
    }

    .toolbar-right {
        flex-shrink: 0;
    }

    .file-name {
        font-size: 0.9rem;
        color: #666;
        font-weight: 500;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: white;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover:not(:disabled) {
        background-color: #f0f0f0;
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
