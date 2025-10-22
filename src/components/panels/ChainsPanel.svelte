<script lang="ts">
    import AccordionPanel from './AccordionPanel.svelte';
    import { chainStore } from '$lib/stores/chains/store';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { isChainClosed } from '$lib/geometry/chain/functions';

    // Props for event callbacks
    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onChainHover: ((chainId: string) => void) | null = null;
    export let onChainHoverEnd: (() => void) | null = null;

    // Reactive state
    $: detectedChains = $chainStore.chains;
    $: selectedChainIds = $chainStore.selectedChainIds;
    $: highlightedChainId = $chainStore.highlightedChainId;
    $: chainNormalizationResults = $prepareStageStore.chainNormalizationResults;
    $: algorithmParams = $prepareStageStore.algorithmParams;
</script>

<AccordionPanel title="Chains ({detectedChains.length})" isExpanded={false}>
    {#if detectedChains.length > 0}
        <div class="chain-summary">
            {#each chainNormalizationResults as result (result.chainId)}
                <div
                    class="chain-summary-item {selectedChainIds.has(
                        result.chainId
                    )
                        ? 'selected'
                        : ''} {highlightedChainId === result.chainId
                        ? 'highlighted'
                        : ''}"
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                        if (onChainClick) {
                            // Check for Ctrl/Cmd key for multi-select
                            if (e.ctrlKey || e.metaKey) {
                                chainStore.toggleChainSelection(result.chainId);
                            } else {
                                chainStore.selectChain(result.chainId, false);
                            }
                            onChainClick(result.chainId);
                        }
                    }}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' && onChainClick) {
                            // Check for Ctrl/Cmd key for multi-select
                            if (e.ctrlKey || e.metaKey) {
                                chainStore.toggleChainSelection(result.chainId);
                            } else {
                                chainStore.selectChain(result.chainId, false);
                            }
                            onChainClick(result.chainId);
                        }
                    }}
                    onmouseenter={() =>
                        onChainHover && onChainHover(result.chainId)}
                    onmouseleave={() => onChainHoverEnd && onChainHoverEnd()}
                >
                    <div class="chain-header">
                        <span class="chain-name"
                            >Chain {result.chainId.split('-')[1]}</span
                        >
                        <div class="chain-indicators">
                            <span
                                class="chain-status {(() => {
                                    const chain = detectedChains.find(
                                        (c) => c.id === result.chainId
                                    );
                                    return chain &&
                                        isChainClosed(
                                            chain,
                                            algorithmParams.chainDetection
                                                .tolerance
                                        )
                                        ? 'closed'
                                        : 'open';
                                })()}"
                            >
                                {(() => {
                                    const chain = detectedChains.find(
                                        (c) => c.id === result.chainId
                                    );
                                    return chain &&
                                        isChainClosed(
                                            chain,
                                            algorithmParams.chainDetection
                                                .tolerance
                                        )
                                        ? 'Closed'
                                        : 'Open';
                                })()}
                            </span>
                            <span
                                class="traversal-status {result.canTraverse
                                    ? 'can-traverse'
                                    : 'cannot-traverse'}"
                            >
                                {result.canTraverse ? '✓' : '✗'}
                            </span>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty-state">
            <p>No chains detected.</p>
        </div>
    {/if}
</AccordionPanel>

<style>
    .chain-summary {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .chain-summary-item {
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
    }

    .chain-summary-item:hover {
        background-color: #f1f5f9;
        border-color: #cbd5e1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .chain-summary-item.selected {
        background-color: #fef3c7;
        border-color: #f59e0b;
    }

    .chain-summary-item.highlighted {
        background-color: #fef9e7;
        border-color: #fbbf24;
    }

    .chain-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .chain-indicators {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .chain-name {
        font-weight: 500;
        color: #374151;
    }

    .chain-status {
        font-size: 0.75rem;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-weight: 500;
    }

    .chain-status.closed {
        background-color: #e6f2f0;
        color: #166534;
    }

    .chain-status.open {
        background-color: #fef3c7;
        color: #92400e;
    }

    .traversal-status {
        font-size: 0.75rem;
        font-weight: 600;
    }

    .traversal-status.can-traverse {
        color: rgb(0, 133, 84);
        font-weight: bold;
    }

    .traversal-status.cannot-traverse {
        color: rgb(133, 18, 0);
        font-weight: bold;
    }

    .empty-state {
        padding: 1rem;
        text-align: center;
        color: #9ca3af;
        background-color: #f9fafb;
        border-radius: 0.375rem;
        border: 1px dashed #d1d5db;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
    }
</style>
