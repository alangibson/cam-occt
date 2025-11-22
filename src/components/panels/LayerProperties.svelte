<script lang="ts">
    import { layerStore } from '$lib/stores/layers/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store';

    // Reactive layer data
    const drawing = $derived($drawingStore.drawing);
    const layers = $derived(drawing ? Object.values(drawing.layers) : []);
    const selectedLayerId = $derived(layerStore.selectedLayerId);
    const highlightedLayerId = $derived(layerStore.highlightedLayerId);
    const activeLayerId = $derived(selectedLayerId || highlightedLayerId);
    const selectedLayer = $derived(
        activeLayerId
            ? layers.find((layer) => layer.name === activeLayerId)
            : null
    );

    async function copyLayerToClipboard() {
        if (!selectedLayer) return;

        try {
            const layerData = selectedLayer.toData();
            const json = JSON.stringify(layerData, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="layer-properties">
    {#if selectedLayer}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{selectedLayer.name}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Shapes:</span>
                <span class="property-value">{selectedLayer.shapes.length}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Chains:</span>
                <span class="property-value">{selectedLayer.chains.length}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Parts:</span>
                <span class="property-value">{selectedLayer.parts.length}</span>
            </div>
        </div>

        <div class="button-row">
            <button
                class="copy-button"
                onclick={copyLayerToClipboard}
                title="Copy layer info to clipboard"
            >
                Copy
            </button>
        </div>
    {/if}
</div>

<style>
    .layer-properties {
        min-height: 200px;
    }

    .property-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.25rem 0;
        min-width: 0;
    }

    .property-label {
        font-weight: 500;
        color: #333;
        min-width: 60px;
        flex-shrink: 0;
    }

    .property-value {
        font-family: 'Courier New', monospace;
        color: #666;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex-shrink: 1;
    }

    .button-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .copy-button {
        padding: 0.25rem 0.75rem;
        background-color: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .copy-button:active {
        background-color: #f3f4f6;
    }
</style>
