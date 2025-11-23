<script lang="ts">
    import { onMount } from 'svelte';
    import ThreeColumnLayout from '$components/layout/ThreeColumnLayout.svelte';
    import Operations from './Operations.svelte';
    import AccordionPanel from '$components/panels/AccordionPanel.svelte';
    import InspectPanel from '$components/panels/InspectPanel.svelte';
    import OptimizePanel from '$components/panels/OptimizePanel.svelte';
    import LayersPanel from '$components/panels/LayersPanel.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { Chain } from '$lib/geometry/chain/classes';
    import { planStore } from '$lib/stores/plan/store';
    import {
        optimizeCutOrder,
        generateRapidsFromCutOrder,
    } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
    import DrawingCanvasContainer from '$components/layout/DrawingCanvasContainer.svelte';
    import ShowPanel from '$components/panels/ShowPanel.svelte';
    import { settingsStore } from '$lib/stores/settings/store';

    // Props from WorkflowContainer for shared canvas
    let {
        sharedCanvas,
        canvasStage,
        onChainClick = null,
        onPartClick = null,
        onChainHover: _onChainHover = null,
        onChainHoverEnd: _onChainHoverEnd = null,
    }: {
        sharedCanvas: typeof DrawingCanvasContainer;
        canvasStage: WorkflowStage;
        onChainClick?: ((chainId: string) => void) | null;
        onPartClick?: ((partId: string) => void) | null;
        onChainHover?: ((chainId: string) => void) | null;
        onChainHoverEnd?: (() => void) | null;
    } = $props();

    let operationsComponent: Operations;

    // Subscribe to stores
    const drawing = $derived($drawingStore.drawing);
    const chains = $derived(
        drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.chains)
            : []
    );
    const parts = $derived(
        drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.parts)
            : []
    );
    const cuts = $derived($planStore.plan.cuts);
    const optimizationSettings = $derived(
        $settingsStore.settings.optimizationSettings
    );

    // Apply zoom to fit when stage mounts
    onMount(async () => {
        const settings = $settingsStore.settings;

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

    $effect(() => {
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
                isOptimizing = true;
                handleOptimizeCutOrder();
                // Reset flag after a short delay to allow for store updates
                setTimeout(() => {
                    isOptimizing = false;
                }, 100);
            }, 0);
        }
    });

    function handleNext() {
        if ($workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)) {
            workflowStore.setStage(WorkflowStage.SIMULATE);
        }
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
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const chainMap = new Map<string, Chain>();
        chains.forEach((chain) => {
            chainMap.set(chain.id, new Chain(chain));
        });

        let result;

        // Convert Cut[] to CutData[] for optimization functions
        // Check if rapid optimization is disabled
        if (optimizationSettings.rapidOptimizationAlgorithm === 'none') {
            console.log(
                'Rapid optimization disabled, generating rapids from current cut order'
            );
            // Generate rapids from existing cut order without optimization
            result = generateRapidsFromCutOrder(cuts, chainMap, parts, {
                x: 0,
                y: 0,
            });
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
        // Rapids are already attached to cuts by optimize/generate functions
        const orderedCutsWithUpdatedOrder = result.orderedCuts.map(
            (cut, index: number) => ({
                ...cut.toData(),
                order: index + 1,
            })
        );
        planStore.updateCuts(orderedCutsWithUpdatedOrder);

        // Count rapids for logging
        const rapidCount = result.orderedCuts.filter(
            (cut) => cut.rapidIn !== undefined
        ).length;

        console.log(
            `${optimizationSettings.rapidOptimizationAlgorithm === 'none' ? 'Generated' : 'Optimized'} cut order: ${result.orderedCuts.length} cuts, ${rapidCount} rapids, total distance: ${result.totalDistance.toFixed(2)} units`
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

            <ShowPanel />
        </svelte:fragment>

        <svelte:fragment slot="center">
            {#if sharedCanvas}
                {@const SharedCanvas = sharedCanvas}
                <SharedCanvas
                    currentStage={canvasStage}
                    {onChainClick}
                    {onPartClick}
                />
            {/if}
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
