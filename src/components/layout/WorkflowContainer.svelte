<script lang="ts">
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import {
        handleChainClick as sharedHandleChainClick,
        handleChainMouseEnter,
        handleChainMouseLeave,
        handlePartClick as sharedHandlePartClick,
        handlePartMouseEnter,
        handlePartMouseLeave,
    } from '$lib/cam/part/chain-part-interactions';
    import ImportStage from '$components/pages/import/ImportStage.svelte';
    import EditStage from '$components/pages/edit/EditStage.svelte';
    import PrepareStage from '$components/pages/prepare/PrepareStage.svelte';
    import ProgramStage from '$components/pages/program/ProgramStage.svelte';
    import SimulateStage from '$components/pages/simulate/SimulateStage.svelte';
    import ExportStage from '$components/pages/export/ExportStage.svelte';
    import DrawingCanvasContainer from '$components/layout/DrawingCanvasContainer.svelte';

    // Get current stage and related state
    $: currentStage = $workflowStore.currentStage;
    $: selectedChainIds = $chainStore.selectedChainIds;
    $: selectedPartIds = $partStore.selectedPartIds;

    // Determine canvas properties based on current stage
    $: canvasStage = (() => {
        switch (currentStage) {
            case 'edit':
                return WorkflowStage.EDIT;
            case 'prepare':
                return WorkflowStage.PREPARE;
            case 'program':
                return WorkflowStage.PROGRAM;
            case 'simulate':
                return WorkflowStage.SIMULATE;
            default:
                return WorkflowStage.EDIT;
        }
    })();

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

    function handlePartHover(partId: string) {
        handlePartMouseEnter(partId);
    }

    function handlePartHoverEnd() {
        handlePartMouseLeave();
    }
</script>

<div class="workflow-container">
    {#if currentStage === 'import'}
        <ImportStage />
    {:else if currentStage === 'export'}
        <ExportStage />
    {:else}
        <!-- Stages that use the shared canvas (edit/prepare/program/simulate) -->
        {#if currentStage === 'edit'}
            <EditStage
                sharedCanvas={DrawingCanvasContainer}
                {canvasStage}
                onChainClick={handleChainClick}
                onPartClick={handlePartClick}
            />
        {:else if currentStage === 'prepare'}
            <PrepareStage
                sharedCanvas={DrawingCanvasContainer}
                {canvasStage}
                onChainClick={handleChainClick}
                onPartClick={handlePartClick}
                onChainHover={handleChainHover}
                onChainHoverEnd={handleChainHoverEnd}
                onPartHover={handlePartHover}
                onPartHoverEnd={handlePartHoverEnd}
            />
        {:else if currentStage === 'program'}
            <ProgramStage
                sharedCanvas={DrawingCanvasContainer}
                {canvasStage}
                onChainClick={handleChainClick}
                onPartClick={handlePartClick}
                onChainHover={handleChainHover}
                onChainHoverEnd={handleChainHoverEnd}
                onPartHover={handlePartHover}
                onPartHoverEnd={handlePartHoverEnd}
            />
        {:else if currentStage === 'simulate'}
            <SimulateStage
                sharedCanvas={DrawingCanvasContainer}
                {canvasStage}
                onChainClick={handleChainClick}
                onPartClick={handlePartClick}
            />
        {/if}
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
