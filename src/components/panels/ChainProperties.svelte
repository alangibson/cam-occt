<script lang="ts">
    import { chainStore } from '$lib/stores/chains/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { isChainClosed } from '$lib/geometry/chain/functions';
    import { detectCutDirection } from '$lib/cam/cut/cut-direction';
    import { CutDirection } from '$lib/cam/cut/enums';
    import {
        getShapeStartPoint,
        getShapeEndPoint,
    } from '$lib/geometry/shape/functions';

    // Reactive chain and analysis data
    const drawing = $derived($drawingStore.drawing);
    const detectedChains = $derived(
        drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.chains)
            : []
    );
    const selectedChainIds = $derived($chainStore.selectedChainIds);
    const selectedChainId = $derived(
        selectedChainIds.size === 1 ? Array.from(selectedChainIds)[0] : null
    );
    const highlightedChainId = $derived($chainStore.highlightedChainId);
    const activeChainId = $derived(selectedChainId || highlightedChainId);
    const selectedChain = $derived(
        activeChainId
            ? detectedChains.find((chain) => {
                  console.log(
                      '[ChainProperties] Looking for chain:',
                      activeChainId,
                      'current:',
                      chain.id
                  );
                  return chain.id === activeChainId;
              })
            : null
    );

    $effect(() => {
        console.log(
            '[ChainProperties] activeChainId:',
            activeChainId,
            'selectedChain:',
            selectedChain?.id,
            'detectedChains:',
            detectedChains.map((c) => c.id),
            'selectedChainAnalysis:',
            selectedChainAnalysis
        );
    });
    const chainNormalizationResults = $derived(
        $prepareStageStore.chainNormalizationResults
    );
    const selectedChainAnalysis = $derived(
        activeChainId
            ? chainNormalizationResults.find(
                  (result) => result.chainId === activeChainId
              )
            : null
    );
    const algorithmParams = $derived($prepareStageStore.algorithmParams);

    async function copyChainToClipboard() {
        if (!selectedChain) return;

        try {
            const json = JSON.stringify(selectedChain, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="chain-properties">
    {#if selectedChain}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{selectedChain.id}</span>
            </div>

            {#if selectedChainAnalysis}
                <div class="property-row">
                    <span class="property-label">Traversable:</span>
                    <span
                        class="property-value {selectedChainAnalysis.canTraverse
                            ? 'can-traverse'
                            : 'cannot-traverse'}"
                    >
                        {selectedChainAnalysis.canTraverse ? 'Yes' : 'No'}
                    </span>
                </div>
            {/if}

            <div class="property-row">
                <span class="property-label">Status:</span>
                <span
                    class="property-value {isChainClosed(
                        selectedChain,
                        algorithmParams.chainDetection.tolerance
                    )
                        ? 'closed'
                        : 'open'}"
                >
                    {isChainClosed(
                        selectedChain,
                        algorithmParams.chainDetection.tolerance
                    )
                        ? 'Closed'
                        : 'Open'}
                </span>
            </div>

            <div class="property-row">
                <span class="property-label">Winding:</span>
                <span class="property-value">
                    {(() => {
                        const direction = detectCutDirection(
                            selectedChain,
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
                <span class="property-label">Shapes:</span>
                <span class="property-value">{selectedChain.shapes.length}</span
                >
            </div>

            {#if selectedChainAnalysis}
                <div class="property-row">
                    <span class="property-label">Issues:</span>
                    <span class="property-value"
                        >{selectedChainAnalysis.issues.length}</span
                    >
                </div>
            {/if}
        </div>

        {#if selectedChain.shapes.length > 0}
            <div class="chain-shapes-section">
                <h4 class="shapes-title">
                    Shapes in Chain ({selectedChain.shapes.length}):
                </h4>
                <div class="chain-shapes-list">
                    {#each selectedChain.shapes as shape, index (`${shape.id}-${index}`)}
                        {@const startPoint = getShapeStartPoint(shape)}
                        {@const endPoint = getShapeEndPoint(shape)}
                        <div class="shape-item">
                            <div class="shape-header">
                                <span class="shape-index">{index + 1}.</span>
                                <span class="shape-type">{shape.type}</span>
                                <span class="shape-id">({shape.id})</span>
                            </div>
                            <div class="shape-points">
                                <div class="point-info">
                                    <span class="point-label">Start:</span>
                                    <span class="point-coords"
                                        >({startPoint.x.toFixed(2)}, {startPoint.y.toFixed(
                                            2
                                        )})</span
                                    >
                                </div>
                                <div class="point-info">
                                    <span class="point-label">End:</span>
                                    <span class="point-coords"
                                        >({endPoint.x.toFixed(2)}, {endPoint.y.toFixed(
                                            2
                                        )})</span
                                    >
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        {#if selectedChainAnalysis && selectedChainAnalysis.issues.length > 0}
            <div class="chain-issues">
                <h4 class="issues-title">Issues:</h4>
                {#each selectedChainAnalysis.issues as issue, issueIndex (issueIndex)}
                    <div class="issue-item">
                        <span class="issue-type"
                            >{issue.type.replace('_', ' ')}</span
                        >
                        <span class="issue-description"
                            >{issue.description}</span
                        >
                    </div>
                {/each}
            </div>
        {/if}

        <div class="button-row">
            <button
                class="copy-button"
                onclick={copyChainToClipboard}
                title="Copy chain JSON to clipboard"
            >
                Copy
            </button>
        </div>
    {:else}
        <p class="debug-info">activeChainId: {activeChainId}</p>
        <p class="debug-info">detectedChains: {detectedChains.length}</p>
    {/if}
</div>

<style>
    .chain-properties {
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

    .property-value.can-traverse {
        color: rgb(0, 133, 84);
        font-weight: 600;
    }

    .property-value.cannot-traverse {
        color: rgb(133, 18, 0);
        font-weight: 600;
    }

    .property-value.closed {
        color: rgb(0, 133, 84);
        font-weight: 600;
    }

    .property-value.open {
        color: rgb(133, 18, 0);
        font-weight: 600;
    }

    .chain-shapes-section {
        margin-top: 1rem;
    }

    .shapes-title,
    .issues-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .chain-shapes-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .shape-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        font-size: 0.75rem;
    }

    .shape-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .shape-points {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-left: 1.5rem;
    }

    .point-info {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .point-label {
        font-weight: 500;
        color: #6b7280;
        min-width: 2.5rem;
    }

    .point-coords {
        font-family: monospace;
        color: #374151;
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.125rem;
        font-size: 0.7rem;
    }

    .shape-index {
        font-weight: 600;
        color: #6b7280;
        min-width: 1.5rem;
    }

    .shape-type {
        font-weight: 500;
        color: #374151;
        text-transform: capitalize;
    }

    .shape-id {
        color: #6b7280;
        font-family: monospace;
    }

    .chain-issues {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin-top: 1rem;
    }

    .issue-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.5rem;
    }

    .issue-item:last-child {
        margin-bottom: 0;
    }

    .issue-type {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgb(133, 18, 0);
        text-transform: capitalize;
    }

    .issue-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
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
