<script lang="ts">
    import { partStore } from '$lib/stores/parts/store';
    import { detectCutDirection } from '$lib/algorithms/cut-direction/cut-direction';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { CutDirection } from '$lib/types/direction';

    // Reactive part data
    $: detectedParts = $partStore.parts;
    $: selectedPartId = $partStore.selectedPartId;
    $: selectedPart = selectedPartId
        ? detectedParts.find((part) => part.id === selectedPartId)
        : null;
    $: algorithmParams = $prepareStageStore.algorithmParams;

    async function copyPartToClipboard() {
        if (!selectedPart) return;

        try {
            const json = JSON.stringify(selectedPart, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="part-properties">
    {#if selectedPart}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{selectedPart.id}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Shell Chain:</span>
                <span class="property-value">{selectedPart.shell.chain.id}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Shell Winding:</span>
                <span class="property-value">
                    {(() => {
                        const direction = detectCutDirection(
                            selectedPart.shell.chain,
                            algorithmParams.chainDetection.tolerance
                        );
                        return direction === CutDirection.CLOCKWISE
                            ? 'CW'
                            : direction === CutDirection.COUNTERCLOCKWISE
                              ? 'CCW'
                              : 'N/A';
                    })()}
                </span>
            </div>

            <div class="property-row">
                <span class="property-label">Shell Shapes:</span>
                <span class="property-value"
                    >{selectedPart.shell.chain.shapes.length}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Holes:</span>
                <span class="property-value">{selectedPart.holes.length}</span>
            </div>
        </div>

        {#if selectedPart.holes.length > 0}
            <div class="holes-section">
                <h4 class="holes-title">
                    Holes ({selectedPart.holes.length}):
                </h4>
                <div class="holes-list">
                    {#each selectedPart.holes as hole, index (hole.id)}
                        <div class="hole-item">
                            <div class="hole-header">
                                <span class="hole-index">Hole {index + 1}</span>
                                <span class="hole-info"
                                    >{hole.chain.shapes.length} shapes</span
                                >
                            </div>
                            <div class="hole-details">
                                <div class="hole-detail-row">
                                    <span class="hole-detail-label">Chain:</span
                                    >
                                    <span class="hole-detail-value"
                                        >{hole.chain.id}</span
                                    >
                                </div>
                                <div class="hole-detail-row">
                                    <span class="hole-detail-label"
                                        >Winding:</span
                                    >
                                    <span class="hole-detail-value">
                                        {(() => {
                                            const direction =
                                                detectCutDirection(
                                                    hole.chain,
                                                    algorithmParams
                                                        .chainDetection
                                                        .tolerance
                                                );
                                            return direction ===
                                                CutDirection.CLOCKWISE
                                                ? 'CW'
                                                : direction ===
                                                    CutDirection.COUNTERCLOCKWISE
                                                  ? 'CCW'
                                                  : 'N/A';
                                        })()}
                                    </span>
                                </div>
                                {#if hole.holes && hole.holes.length > 0}
                                    <div class="hole-detail-row">
                                        <span class="hole-detail-label"
                                            >Nested Holes:</span
                                        >
                                        <span class="hole-detail-value"
                                            >{hole.holes.length}</span
                                        >
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="button-row">
            <button
                class="copy-button"
                onclick={copyPartToClipboard}
                title="Copy part JSON to clipboard"
            >
                Copy
            </button>
        </div>
    {/if}
</div>

<style>
    .part-properties {
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
        min-width: 90px;
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

    .holes-section {
        margin-top: 1rem;
    }

    .holes-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .holes-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .hole-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        font-size: 0.75rem;
    }

    .hole-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e2e8f0;
    }

    .hole-index {
        font-weight: 600;
        color: rgb(0, 83, 135);
        font-size: 0.875rem;
    }

    .hole-info {
        font-size: 0.75rem;
        color: #6b7280;
        background-color: #e5e7eb;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .hole-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .hole-detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
    }

    .hole-detail-label {
        font-weight: 500;
        color: #6b7280;
    }

    .hole-detail-value {
        font-family: monospace;
        color: #374151;
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.125rem;
        font-size: 0.7rem;
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
