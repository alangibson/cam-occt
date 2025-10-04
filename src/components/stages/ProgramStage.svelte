<script lang="ts">
    import ThreeColumnLayout from '../ThreeColumnLayout.svelte';
    import Operations from '../Operations.svelte';
    import Paths from '../Paths.svelte';
    import AccordionPanel from '../AccordionPanel.svelte';
    import InspectPanel from '../InspectPanel.svelte';
    import PartsPanel from '../PartsPanel.svelte';
    import ChainsPanel from '../ChainsPanel.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { SvelteMap } from 'svelte/reactivity';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import { pathStore } from '$lib/stores/paths/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import {
        selectRapid,
        highlightRapid,
        clearRapidHighlight,
    } from '$lib/stores/rapids/functions';
    import { leadWarningsStore } from '$lib/stores/lead-warnings/store';
    import { offsetWarningsStore } from '$lib/stores/offset-warnings/store';
    import { optimizeCutOrder } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
    import DrawingCanvasContainer from '../DrawingCanvasContainer.svelte';
    import ShowPanel from '../ShowPanel.svelte';

    // Props from WorkflowContainer for shared canvas
    export let sharedCanvas: typeof DrawingCanvasContainer;
    export let canvasStage: WorkflowStage;
    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;
    export let onChainHover: ((chainId: string) => void) | null = null;
    export let onChainHoverEnd: (() => void) | null = null;
    export let onPartHover: ((partId: string) => void) | null = null;
    export let onPartHoverEnd: (() => void) | null = null;

    let operationsComponent: Operations;

    // Subscribe to stores
    $: drawing = $drawingStore.drawing;
    $: chains = $chainStore.chains;
    $: parts = $partStore.parts;
    $: selectedChainId = $chainStore.selectedChainId;
    $: highlightedChainId = $chainStore.highlightedChainId;
    $: _highlightedPartId = $partStore.highlightedPartId;
    $: hoveredPartId = $partStore.hoveredPartId;
    $: selectedPartId = $partStore.selectedPartId;
    $: paths = $pathStore.paths;
    $: rapids = $rapidStore.rapids;
    $: selectedRapidId = $rapidStore.selectedRapidId;
    $: highlightedRapidId = $rapidStore.highlightedRapidId;
    $: leadWarnings = $leadWarningsStore.warnings;
    $: offsetWarnings = $offsetWarningsStore.warnings;

    // Track previous hash to prevent infinite loops
    let previousPathsHash = '';
    let isOptimizing = false;

    // Automatically recalculate rapids when paths change
    // We only react to lead-related changes, not order changes to avoid loops

    $: {
        // Only include properties that affect lead geometry, not order
        const pathsHash = paths
            .map(
                (p) =>
                    `${p.id}:${p.leadInConfig?.type}:${p.leadInConfig?.length}:${p.leadInConfig?.flipSide}:${p.leadInConfig?.angle}:${p.leadOutConfig?.type}:${p.leadOutConfig?.length}:${p.leadOutConfig?.flipSide}:${p.leadOutConfig?.angle}:${p.enabled}`
            )
            .join('|');

        // Only trigger if the hash actually changed and we have the necessary data
        if (
            pathsHash !== previousPathsHash &&
            paths.length > 0 &&
            chains.length > 0 &&
            drawing &&
            !isOptimizing
        ) {
            previousPathsHash = pathsHash;
            // Use setTimeout to avoid recursive updates and ensure all stores are synced
            setTimeout(() => {
                // eslint-disable-next-line svelte/infinite-reactive-loop
                isOptimizing = true;
                handleOptimizeCutOrder();
                // Reset flag after a short delay to allow for store updates
                setTimeout(() => {
                    // eslint-disable-next-line svelte/infinite-reactive-loop
                    isOptimizing = false;
                }, 100);
            }, 0);
        }
    }

    // Clear rapids when no paths exist
    $: {
        if (paths.length === 0) {
            rapidStore.clearRapids();
            selectRapid(null);
        }
    }

    function handleNext() {
        if ($workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)) {
            workflowStore.setStage(WorkflowStage.SIMULATE);
        }
    }

    // Rapid selection functions
    function handleRapidClick(rapidId: string) {
        if (selectedRapidId === rapidId) {
            selectRapid(null); // Deselect if already selected
        } else {
            selectRapid(rapidId);
        }
    }

    function handleRapidMouseEnter(rapidId: string) {
        highlightRapid(rapidId);
    }

    function handleRapidMouseLeave() {
        clearRapidHighlight();
    }

    // Handle adding new operation
    function handleAddOperation() {
        if (operationsComponent) {
            operationsComponent.addNewOperation();
        }
    }

    // Handle cut order optimization
    function handleOptimizeCutOrder() {
        if (!drawing || chains.length === 0 || paths.length === 0) {
            console.warn(
                'No drawing, chains, or paths available for optimization'
            );
            return;
        }

        // Create a map of chain IDs to chains for quick lookup
        const chainMap = new SvelteMap<string, Chain>();
        chains.forEach((chain) => {
            chainMap.set(chain.id, chain);
        });

        // Optimize the cut order
        const result = optimizeCutOrder(paths, chainMap, parts);

        // Update the path order in the store with corrected order property
        const orderedPathsWithUpdatedOrder = result.orderedPaths.map(
            (path, index) => ({
                ...path,
                order: index + 1,
            })
        );
        pathStore.reorderPaths(orderedPathsWithUpdatedOrder);

        // Update the rapids in the store
        rapidStore.setRapids(result.rapids);

        console.log(
            `Optimized cut order: ${result.orderedPaths.length} paths, ${result.rapids.length} rapids, total distance: ${result.totalDistance.toFixed(2)} units`
        );
    }
</script>

<div class="program-stage">
    <ThreeColumnLayout
        leftColumnStorageKey="metalheadcam-program-left-column-width"
        rightColumnStorageKey="metalheadcam-program-right-column-width"
    >
        <svelte:fragment slot="left">
            <AccordionPanel title="Paths ({paths.length})" isExpanded={false}>
                <Paths />
            </AccordionPanel>

            <AccordionPanel title="Rapids ({rapids.length})" isExpanded={false}>
                <div class="cut-order-list">
                    {#if rapids.length > 0}
                        {#each rapids as rapid, index (rapid.id)}
                            <div
                                class="rapid-item {selectedRapidId === rapid.id
                                    ? 'selected'
                                    : ''} {highlightedRapidId === rapid.id
                                    ? 'highlighted'
                                    : ''}"
                                role="button"
                                tabindex="0"
                                onclick={() => handleRapidClick(rapid.id)}
                                onkeydown={(e) =>
                                    e.key === 'Enter' &&
                                    handleRapidClick(rapid.id)}
                                onmouseenter={() =>
                                    handleRapidMouseEnter(rapid.id)}
                                onmouseleave={handleRapidMouseLeave}
                            >
                                <span class="rapid-index">{index + 1}.</span>
                                <span class="rapid-description">
                                    Rapid to ({rapid.end.x.toFixed(2)}, {rapid.end.y.toFixed(
                                        2
                                    )})
                                </span>
                            </div>
                        {/each}
                    {:else}
                        <p class="no-rapids">No rapids generated yet.</p>
                    {/if}
                </div>
            </AccordionPanel>

            {#if parts.length > 0}
                <PartsPanel {onPartClick} {onPartHover} {onPartHoverEnd} />
            {/if}

            {#if chains.length > 0}
                <ChainsPanel {onChainClick} {onChainHover} {onChainHoverEnd} />
            {/if}

            <AccordionPanel title="Next Stage" isExpanded={true}>
                <div class="next-stage-content">
                    <button
                        class="next-button"
                        class:disabled={!$workflowStore.canAdvanceTo(
                            WorkflowStage.SIMULATE
                        )}
                        disabled={!$workflowStore.canAdvanceTo(
                            WorkflowStage.SIMULATE
                        )}
                        onclick={handleNext}
                    >
                        Next: Simulate Cutting
                    </button>
                    <p class="next-help">
                        {#if !$workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)}
                            Create at least one operation with paths to simulate
                            the cutting process.
                        {:else}
                            Review your tool paths and simulate the cutting
                            process.
                        {/if}
                    </p>
                </div>
            </AccordionPanel>
        </svelte:fragment>

        <svelte:fragment slot="center">
            <svelte:component
                this={sharedCanvas}
                currentStage={canvasStage}
                {onChainClick}
                {onPartClick}
            />
        </svelte:fragment>

        <svelte:fragment slot="right">
            <AccordionPanel title="Operations" isExpanded={true}>
                <button
                    slot="header-button"
                    onclick={handleAddOperation}
                    class="add-operation-button"
                >
                    Add
                </button>
                <Operations bind:this={operationsComponent} />
            </AccordionPanel>

            <InspectPanel />

            <AccordionPanel
                title="Problems ({offsetWarnings.length})"
                isExpanded={false}
            >
                <div class="offset-warnings-list">
                    {#if offsetWarnings.length > 0}
                        {#each offsetWarnings as warning (warning.id)}
                            <div class="warning-item offset-warning">
                                <div class="warning-header">
                                    <span class="warning-type {warning.type}">
                                        ⚠️ {warning.type}
                                    </span>
                                    <span class="warning-chain"
                                        >Chain {warning.chainId.split(
                                            '-'
                                        )[1]}</span
                                    >
                                </div>
                                <p class="warning-message">{warning.message}</p>
                            </div>
                        {/each}
                    {:else}
                        <p class="no-problems">
                            No problems detected. All offset calculations
                            completed successfully.
                        </p>
                    {/if}
                </div>
            </AccordionPanel>

            {#if leadWarnings.length > 0}
                <AccordionPanel
                    title="Lead Warnings ({leadWarnings.length})"
                    isExpanded={true}
                >
                    <div class="lead-warnings-list">
                        {#each leadWarnings as warning (warning.id)}
                            <div class="warning-item">
                                <div class="warning-header">
                                    <span
                                        class="warning-type {warning.type ===
                                        'lead-in'
                                            ? 'lead-in'
                                            : 'lead-out'}"
                                    >
                                        {warning.type === 'lead-in' ? '◉' : '◎'}
                                        {warning.type === 'lead-in'
                                            ? 'Lead-in'
                                            : 'Lead-out'}
                                    </span>
                                    <span class="warning-chain"
                                        >Chain {warning.chainId.split(
                                            '-'
                                        )[1]}</span
                                    >
                                </div>
                                <p class="warning-message">{warning.message}</p>
                            </div>
                        {/each}
                    </div>
                </AccordionPanel>
            {/if}

            <ShowPanel />
        </svelte:fragment>
    </ThreeColumnLayout>
</div>

<style>
    .program-stage {
        display: flex;
        flex-direction: column;
        height: 100%;
    }


    .next-stage-content {
        background: linear-gradient(
            135deg,
            rgb(0, 83, 135) 0%,
            rgb(0, 83, 135) 100%
        );
        color: white;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .next-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 0.5rem;
    }

    .next-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .next-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .next-help {
        margin: 0;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.4;
    }

    /* Removed .panel-title styles - now handled by AccordionPanel component */

    /* Cut Order section styles */
    .cut-order-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .rapid-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background-color: #f9fafb;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .rapid-item:hover {
        background-color: #f3f4f6;
    }

    .rapid-item.highlighted {
        background-color: #fef3c7;
        border-color: #f59e0b;
    }

    .rapid-item.selected {
        background-color: #e6f2ff;
        border-color: rgb(0, 83, 135);
    }

    .rapid-index {
        font-weight: 600;
        color: #374151;
        min-width: 1.5rem;
    }

    .rapid-description {
        color: #6b7280;
    }

    .no-rapids {
        color: #6b7280;
        font-size: 0.875rem;
        text-align: center;
        padding: 1rem;
        margin: 0;
    }

    /* Offset Warnings section styles */
    .offset-warnings-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .warning-item.offset-warning {
        padding: 0.75rem;
        background-color: #fef2f2;
        border: 1px solid rgba(133, 0, 15, 0.4);
        border-radius: 0.375rem;
        border-left: 4px solid rgb(133, 18, 0);
    }

    .warning-type.offset {
        color: rgb(133, 18, 0);
    }

    .warning-type.trim {
        color: #ea580c;
    }

    .warning-type.gap {
        color: #d97706;
    }

    .warning-type.intersection {
        color: #7c2d12;
    }

    .warning-type.geometry {
        color: #991b1b;
    }

    .no-problems {
        color: #6b7280;
        font-size: 0.875rem;
        text-align: center;
        padding: 1rem;
        margin: 0;
    }

    /* Lead Warnings section styles */
    .lead-warnings-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .warning-item {
        padding: 0.75rem;
        background-color: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 0.375rem;
        border-left: 4px solid #f59e0b;
    }

    .warning-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .warning-type {
        font-weight: 600;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .warning-type.lead-in {
        color: rgb(0, 83, 135);
    }

    .warning-type.lead-out {
        color: rgb(133, 18, 0);
    }

    .warning-chain {
        font-size: 0.75rem;
        color: #92400e;
        background-color: rgba(245, 158, 11, 0.1);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-weight: 500;
    }

    .warning-message {
        margin: 0;
        font-size: 0.875rem;
        color: #92400e;
        line-height: 1.4;
    }

    .add-operation-button {
        padding: 0.25rem 0.5rem;
        background: rgb(0, 83, 135);
        color: white;
        border: none;
        border-radius: 0.25rem;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .add-operation-button:hover {
        background: rgb(0, 83, 135);
    }
</style>
