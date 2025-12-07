<script lang="ts">
    import { workflowStore } from '$lib/stores/workflow/store.svelte';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { selectionStore } from '$lib/stores/selection/store.svelte';
    import {
        handleChainClick as sharedHandleChainClick,
        handleChainMouseEnter,
        handleChainMouseLeave,
        handlePartClick as sharedHandlePartClick,
    } from '$lib/cam/part/chain-part-interactions';
    import ImportStage from '$components/pages/import/ImportStage.svelte';
    import ProgramStage from '$components/pages/program/ProgramStage.svelte';
    import SimulateStage from '$components/pages/simulate/SimulateStage.svelte';
    import ExportStage from '$components/pages/export/ExportStage.svelte';
    import DrawingCanvasContainer from '$components/layout/DrawingCanvasContainer.svelte';

    // Get current stage and related state
    const currentStage = $derived(workflowStore.currentStage);
    const selectedChainIds = $derived(selectionStore.chains.selected);
    const selectedPartIds = $derived(selectionStore.parts.selected);

    // Determine canvas properties based on current stage
    const canvasStage = $derived(
        (() => {
            switch (currentStage) {
                case 'program':
                    return WorkflowStage.PROGRAM;
                case 'simulate':
                    return WorkflowStage.SIMULATE;
                default:
                    return WorkflowStage.PROGRAM;
            }
        })()
    );

    // Chain and part interaction functions using shared handlers
    function handleChainClick(chainId: string) {
        sharedHandleChainClick(chainId, selectedChainIds);
    }

    function handlePartClick(partId: string) {
        sharedHandlePartClick(partId, selectedPartIds);
    }

    // Mouse hover functions for highlighting
    function handleChainHover(chainId: string) {
        handleChainMouseEnter(chainId);
    }

    function handleChainHoverEnd() {
        handleChainMouseLeave();
    }
</script>

<div class="workflow-container">
    {#if currentStage === 'import'}
        <ImportStage />
    {:else if currentStage === 'export'}
        <ExportStage />
    {:else if currentStage === 'program'}
        <ProgramStage
            sharedCanvas={DrawingCanvasContainer}
            {canvasStage}
            onChainClick={handleChainClick}
            onPartClick={handlePartClick}
            onChainHover={handleChainHover}
            onChainHoverEnd={handleChainHoverEnd}
        />
    {:else if currentStage === 'simulate'}
        <SimulateStage
            sharedCanvas={DrawingCanvasContainer}
            {canvasStage}
            onChainClick={handleChainClick}
            onPartClick={handlePartClick}
        />
    {/if}
</div>

<style>
    .workflow-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
</style>
