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
    } from '$lib/algorithms/part-detection/chain-part-interactions';
    import ImportStage from './stages/ImportStage.svelte';
    import EditStage from './stages/EditStage.svelte';
    import PrepareStage from './stages/PrepareStage.svelte';
    import ProgramStage from './stages/ProgramStage.svelte';
    import SimulateStage from './stages/SimulateStage.svelte';
    import ExportStage from './stages/ExportStage.svelte';
    import DrawingCanvasContainer from './DrawingCanvasContainer.svelte';

    // Get current stage and related state
    $: currentStage = $workflowStore.currentStage;
    $: selectedChainId = $chainStore.selectedChainId;
    $: selectedPartId = $partStore.selectedPartId;

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

    // Determine interaction mode based on current stage
    let interactionMode: 'shapes' | 'chains' | 'paths';
    $: {
        switch (currentStage) {
            case 'prepare':
                interactionMode = 'chains';
                break;
            case 'program':
                interactionMode = 'chains';
                break;
            default:
                interactionMode = 'shapes';
                break;
        }
    }

    // Chain and part interaction functions using shared handlers
    function handleChainClick(chainId: string) {
        sharedHandleChainClick(chainId, selectedChainId);
    }

    function handlePartClick(partId: string) {
        sharedHandlePartClick(partId, selectedPartId);
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
                {interactionMode}
                onChainClick={handleChainClick}
                onPartClick={handlePartClick}
            />
        {:else if currentStage === 'prepare'}
            <PrepareStage
                sharedCanvas={DrawingCanvasContainer}
                {canvasStage}
                {interactionMode}
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
                {interactionMode}
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
                {interactionMode}
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
