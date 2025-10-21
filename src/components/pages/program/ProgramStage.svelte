<script lang="ts">
    import { onMount } from 'svelte';
    import ThreeColumnLayout from '$components/layout/ThreeColumnLayout.svelte';
    import Operations from './Operations.svelte';
    import Cuts from './Cuts.svelte';
    import AccordionPanel from '$components/panels/AccordionPanel.svelte';
    import InspectPanel from '$components/panels/InspectPanel.svelte';
    import PartsPanel from '$components/panels/PartsPanel.svelte';
    import ChainsPanel from '$components/panels/ChainsPanel.svelte';
    import OptimizePanel from '$components/panels/OptimizePanel.svelte';
    import LayersPanel from '$components/panels/LayersPanel.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { SvelteMap } from 'svelte/reactivity';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import { cutStore } from '$lib/stores/cuts/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import {
        selectRapid,
        highlightRapid,
        clearRapidHighlight,
    } from '$lib/stores/rapids/functions';
    import { optimizeCutOrder, generateRapidsFromCutOrder } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
    import DrawingCanvasContainer from '$components/layout/DrawingCanvasContainer.svelte';
    import ShowPanel from '$components/panels/ShowPanel.svelte';
    import { applyAutoPreprocessing } from '$lib/preprocessing/auto-preprocess';
    import { settingsStore } from '$lib/stores/settings/store';

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
    $: cuts = $cutStore.cuts;
    $: rapids = $rapidStore.rapids;
    $: selectedRapidId = $rapidStore.selectedRapidId;
    $: highlightedRapidId = $rapidStore.highlightedRapidId;
    $: optimizationSettings = $settingsStore.settings.optimizationSettings;

    // Track preprocessing state
    let hasRunPreprocessing = false;

    // Run preprocessing when stage mounts (only if chains/parts don't exist)
    onMount(async () => {
        const settings = $settingsStore.settings;
        const currentChains = $chainStore.chains;
        const currentParts = $partStore.parts;

        // Only run preprocessing if we don't have chains or parts yet
        // and preprocessing steps are enabled
        if (
            (currentChains.length === 0 || currentParts.length === 0) &&
            settings.enabledPreprocessingSteps.length > 0 &&
            !hasRunPreprocessing
        ) {
            console.log(
                'Program stage: Running auto-preprocessing to detect chains/parts...'
            );
            hasRunPreprocessing = true;

            try {
                await applyAutoPreprocessing();
                console.log('Auto-preprocessing completed successfully');
            } catch (error) {
                console.error('Error during auto-preprocessing:', error);
            }
        }

        // Apply zoom to fit if enabled in settings
        if (settings.optimizationSettings.zoomToFit) {
            drawingStore.zoomToFit();
        }
    });

    // Track previous hash to prevent infinite loops
    let previousPathsHash = '';
    let isOptimizing = false;

    // Automatically recalculate rapids when cuts or optimization settings change
    // We only react to lead-related changes, not order changes to avoid loops

    $: {
        // Include properties that affect lead geometry and cut start/end positions
        // Sort by ID to make hash order-independent (so reordering cuts doesn't trigger recalculation)
        const cutsHash = cuts
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(
                (c) =>
                    `${c.id}:${c.normalConnectionPoint?.x}:${c.normalConnectionPoint?.y}:${c.leadIn?.geometry?.center?.x}:${c.leadIn?.geometry?.center?.y}:${c.leadIn?.geometry?.radius}:${c.leadIn?.geometry?.startAngle}:${c.leadIn?.geometry?.endAngle}:${c.leadOut?.geometry?.center?.x}:${c.leadOut?.geometry?.center?.y}:${c.leadOut?.geometry?.radius}:${c.leadOut?.geometry?.startAngle}:${c.leadOut?.geometry?.endAngle}:${c.leadInConfig?.type}:${c.leadInConfig?.length}:${c.leadInConfig?.flipSide}:${c.leadInConfig?.angle}:${c.leadOutConfig?.type}:${c.leadOutConfig?.length}:${c.leadOutConfig?.flipSide}:${c.leadOutConfig?.angle}:${c.enabled}`
            )
            .join('|');

        // Include optimization settings in the hash to trigger re-optimization when they change
        const optimizationHash = `${cutsHash}|cutHolesFirst:${optimizationSettings.cutHolesFirst}`;

        // Only trigger if the hash actually changed and we have the necessary data
        if (
            optimizationHash !== previousPathsHash &&
            cuts.length > 0 &&
            chains.length > 0 &&
            drawing &&
            !isOptimizing
        ) {
            console.log(
                '[ProgramStage] Cut hash or optimization settings changed, recalculating rapids'
            );
            previousPathsHash = optimizationHash;
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

    // Clear rapids when no cuts exist
    $: {
        if (cuts.length === 0) {
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
        if (!drawing || chains.length === 0 || cuts.length === 0) {
            console.warn(
                'No drawing, chains, or cuts available for optimization'
            );
            return;
        }

        // Create a map of chain IDs to chains for quick lookup
        const chainMap = new SvelteMap<string, Chain>();
        chains.forEach((chain) => {
            chainMap.set(chain.id, chain);
        });

        let result;

        // Check if rapid optimization is disabled
        if (optimizationSettings.rapidOptimizationAlgorithm === 'none') {
            console.log('Rapid optimization disabled, generating rapids from current cut order');
            // Generate rapids from existing cut order without optimization
            result = generateRapidsFromCutOrder(
                cuts,
                chainMap,
                parts,
                { x: 0, y: 0 }
            );
        } else {
            // Optimize the cut order with cutHolesFirst setting
            result = optimizeCutOrder(
                cuts,
                chainMap,
                parts,
                { x: 0, y: 0 },
                optimizationSettings.cutHolesFirst
            );
        }

        // Update the cut order in the store with corrected order property
        const orderedCutsWithUpdatedOrder = result.orderedCuts.map(
            (cut, index) => ({
                ...cut,
                order: index + 1,
            })
        );
        cutStore.reorderCuts(orderedCutsWithUpdatedOrder);

        // Update the rapids in the store
        rapidStore.setRapids(result.rapids);

        console.log(
            `${optimizationSettings.rapidOptimizationAlgorithm === 'none' ? 'Generated' : 'Optimized'} cut order: ${result.orderedCuts.length} cuts, ${result.rapids.length} rapids, total distance: ${result.totalDistance.toFixed(2)} units`
        );
    }
</script>

<div class="program-stage">
    <ThreeColumnLayout
        leftColumnStorageKey="metalheadcam-program-left-column-width"
        rightColumnStorageKey="metalheadcam-program-right-column-width"
    >
        <svelte:fragment slot="left">
            <LayersPanel />

            {#if parts.length > 0}
                <PartsPanel {onPartClick} {onPartHover} {onPartHoverEnd} />
            {/if}

            {#if chains.length > 0}
                <ChainsPanel {onChainClick} {onChainHover} {onChainHoverEnd} />
            {/if}

            <div class="arrow-separator">
                <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none">
                    <polygon points="50,14 0,0 100,0" fill="#9ca3af" />
                </svg>
            </div>

            <AccordionPanel title="Cuts ({cuts.length})" isExpanded={false}>
                <Cuts />
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

            <OptimizePanel />

            <InspectPanel />

            <ShowPanel />

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
                            Create at least one operation with cuts to simulate
                            the cutting process.
                        {:else}
                            Review your tool cuts and simulate the cutting
                            process.
                        {/if}
                    </p>
                </div>
            </AccordionPanel>
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

    .arrow-separator {
        padding: 0;
    }
</style>
